from datetime import timedelta
from typing import Union
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt

from routers.cost_estimation import router as cost_estimation_router
from database import models
from database.models import SessionLocal
import schemas, security

app = FastAPI()
app.include_router(cost_estimation_router, prefix="/cost-estimation", tags=["Cost Estimation"])

@app.get("/")
def read_root():
    return {"Hello": "World"}
