import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Load the variables from the .env file
load_dotenv()

# Get the URL from the .env file, fallback to localhost if missing
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://saas_admin:securepassword@localhost:5432/saas_gateway"
)

# Create the SQLAlchemy engine WITH Connection Pooling
# pool_size=10: Keep 10 connections open and ready
# max_overflow=20: Allow up to 20 extra connections during traffic spikes
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30
)

# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create the base class for our database models
Base = declarative_base()

# Dependency to get the database session in our API routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()