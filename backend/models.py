from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # Different tiers get different rate limits (e.g., 'free', 'pro', 'enterprise')
    subscription_tier = Column(String, default="free") 
    
    # Links the user to their generated API keys
    api_keys = relationship("ApiKey", back_populates="owner")

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, index=True)
    hashed_key = Column(String, unique=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    
    # The specific rate limit for this exact API key
    rate_limit = Column(Integer, default=5) 
    
    owner = relationship("User", back_populates="api_keys")