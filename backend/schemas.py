from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    attributes: Dict[str, Any]

class Project(ProjectCreate):
    id: int
    start_date: datetime
    created_at: datetime
    updated_at: datetime
    user_id: int
    estimates: Dict[str, float]
    
    class Config:
        from_attributes = True
