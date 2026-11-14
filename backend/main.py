from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import secrets

import models
from database import engine, get_db
from auth import get_password_hash, verify_password, create_access_token
from rate_limiter import check_rate_limit, redis_client
from redis.exceptions import RedisError
from starlette.concurrency import run_in_threadpool
import hashlib

models.Base.metadata.create_all(bind=engine)

AUTH_CACHE_TTL = 300      # seconds a verified key stays cached
INVALID_CACHE_TTL = 60    # seconds a bad key is remembered (blocks bcrypt spam)


def _find_key_limit(db: Session, raw_key: str):
    """Blocking bcrypt scan. Returns the key's rate limit, or None if invalid."""
    for record in db.query(models.ApiKey).all():
        if verify_password(raw_key, record.hashed_key):
            return record.rate_limit
    return None

app = FastAPI()
@app.get("/")
def read_root():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- AUTHENTICATION ROUTES ---

@app.post("/signup")
def signup(email: str, password: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pw = get_password_hash(password)
    new_user = models.User(email=email, hashed_password=hashed_pw)
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully!"}

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# --- SAAS DASHBOARD ROUTES ---

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from auth import SECRET_KEY, ALGORITHM
    import jwt
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.post("/generate-key")
def generate_key(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    raw_api_key = secrets.token_urlsafe(32)
    hashed_key = get_password_hash(raw_api_key)
    
    new_key = models.ApiKey(hashed_key=hashed_key, owner_id=current_user.id)
    db.add(new_key)
    db.commit()
    
    return {"api_key": raw_api_key, "rate_limit": 5}

# --- PROTECTED API ROUTE ---

@app.get("/secure-data")
async def get_secure_data(x_api_key: str = Header(None), db: Session = Depends(get_db)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing x-api-key in headers")
        
    # Fast path: a recent successful (or failed) bcrypt check is cached in Redis,
    # keyed by a SHA-256 of the key so the raw key is never stored.
    cache_key = "auth:" + hashlib.sha256(x_api_key.encode("utf-8")).hexdigest()
    cached = None
    try:
        cached = await redis_client.get(cache_key)
    except RedisError:
        pass  # cache is optional; fall through to the DB check

    if cached == "invalid":
        raise HTTPException(status_code=401, detail="Invalid API Key")

    if cached is not None:
        limit = int(cached)
    else:
        # Slow path: bcrypt is CPU-bound, so run it off the event loop.
        limit = await run_in_threadpool(_find_key_limit, db, x_api_key)
        try:
            await redis_client.set(
                cache_key,
                "invalid" if limit is None else limit,
                ex=INVALID_CACHE_TTL if limit is None else AUTH_CACHE_TTL,
            )
        except RedisError:
            pass
        if limit is None:
            raise HTTPException(status_code=401, detail="Invalid API Key")

    remaining = await check_rate_limit(x_api_key, limit)
    
    return {
        "message": "Authentication and Rate Limiting Successful!",
        "data": "Here is the top-secret VIP data.",
        "remaining_quota": remaining
    }
