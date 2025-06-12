from datetime import timedelta, datetime
from typing import Union
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware

from routers.auth import router as auth_router
from routers.cost_estimation import router as cost_estimation_router
from routers.project import router as project_router
from routers.budgeting import router as budgeting_router
from database import models
from database.models import SessionLocal
import schemas, security

app = FastAPI(
    title="Economic Analysis API",
    description="Comprehensive cost estimation and project analysis system",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(cost_estimation_router, prefix="/cost-estimation", tags=["Cost Estimation"])
app.include_router(project_router, prefix="/projects", tags=["Projects"])
app.include_router(budgeting_router, prefix="/budgeting", tags=["Budgeting"])

@app.get("/")
def read_root():
    return {
        "message": "Economic Analysis API",
        "version": "1.0.0",
        "features": [
            "Multiple cost estimation techniques",
            "Project management",
            "Estimation comparison and analysis",
            "User authentication"
        ],
        "estimation_methods": [
            "COCOMO (Basic & Intermediate)",
            "Function Points",
            "Expert Judgment",
            "Delphi Method",
            "Regression Analysis"
        ]
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": str(datetime.utcnow())}
