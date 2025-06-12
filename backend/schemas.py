from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
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

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class EstimationInput(BaseModel):
    # COCOMO inputs
    size_kloc: Optional[float] = None
    mode: Optional[str] = None
    
    # Function Points inputs
    ufp: Optional[int] = None
    caf: Optional[float] = None
    
    # Expert Judgment inputs
    expert_estimates: Optional[List[float]] = None
    
    # Regression inputs
    regression_size: Optional[float] = None

class ProjectEstimation(BaseModel):
    project_id: int
    estimation_input: EstimationInput
    
class Project(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    start_date: datetime
    created_at: datetime
    updated_at: datetime
    user_id: int
    attributes: Optional[Dict[str, Any]] = None
    estimates: Optional[Dict[str, Any]] = None
    initial_budget: Optional[float] = None
    actual_cost: Optional[float] = None
    expected_revenue: Optional[float] = None
    discount_rate: Optional[float] = None
    cash_flows: Optional[Dict[str, Any]] = None
    budget_tracking: Optional[Dict[str, Any]] = None
    financial_metrics: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class ProjectSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    estimated_cost: Optional[float] = None
    estimation_methods_count: int = 0

class FinancialMetrics(BaseModel):
    roi: Optional[float] = None
    npv: Optional[float] = None
    irr: Optional[float] = None
    payback_period: Optional[float] = None
    details: Optional[Dict] = None

class BudgetInfo(BaseModel):
    initial_budget: float = Field(..., gt=0)
    expected_revenue: Optional[float] = None
    discount_rate: Optional[float] = None

class Resource(BaseModel):
    id: str
    name: str
    cost_per_hour: float
    max_hours_per_day: float = 8.0
    skills: List[str]

class Task(BaseModel):
    id: str
    name: str
    duration_hours: float
    required_skills: List[str]
    dependencies: Optional[List[str]] = None
    earliest_start: Optional[datetime] = None
    deadline: Optional[datetime] = None

class RiskVariable(BaseModel):
    min_value: float
    max_value: float
    most_likely: Optional[float] = None
    distribution: str = "uniform"

class Project(ProjectCreate):
    id: int
    start_date: datetime
    created_at: datetime
    updated_at: datetime
    user_id: int
    attributes: Optional[Dict[str, Any]] = None
    estimates: Optional[Dict[str, Any]] = None
    initial_budget: Optional[float] = None
    actual_cost: Optional[float] = None
    expected_revenue: Optional[float] = None
    discount_rate: Optional[float] = None
    cash_flows: Optional[Dict[str, Any]] = None
    budget_tracking: Optional[Dict[str, Any]] = None
    financial_metrics: Optional[Dict[str, Any]] = None
    risk_analysis: Optional[Dict[str, Any]] = None
    resource_allocation: Optional[Dict[str, Any]] = None
    resources: Optional[List[Resource]] = None
    tasks: Optional[List[Task]] = None

    class Config:
        from_attributes = True
