from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel, Field
import numpy as np
from numpy.typing import ArrayLike

from database import models
from db import get_db
import schemas
from security import oauth2_scheme, get_current_user

router = APIRouter()

class CashFlow(BaseModel):
    period: int
    amount: float
    description: Optional[str] = None

class FinancialInput(BaseModel):
    initial_investment: float = Field(..., gt=0)
    cash_flows: List[float] = Field(..., min_items=1)
    discount_rate: float = Field(..., ge=0, le=100)

class BudgetUpdate(BaseModel):
    actual_cost: float
    period: str  # e.g., "2025-06" for June 2025
    category: str
    description: Optional[str] = None

class FinancialMetrics(BaseModel):
    roi: float
    npv: float
    irr: Optional[float]
    payback_period: Optional[float]
    details: Dict

def calculate_roi(initial_investment: float, total_returns: float) -> float:
    """Calculate Return on Investment (ROI)"""
    return ((total_returns - initial_investment) / initial_investment) * 100

def calculate_npv(cash_flows: ArrayLike, discount_rate: float) -> float:
    """Calculate Net Present Value (NPV)"""
    rate = discount_rate / 100  # Convert percentage to decimal
    npv = np.npv(rate, cash_flows)
    return round(npv, 2)

def calculate_irr(cash_flows: ArrayLike) -> Optional[float]:
    """Calculate Internal Rate of Return (IRR)"""
    try:
        irr = np.irr(cash_flows)
        return round(float(irr) * 100, 2)  # Convert to percentage
    except:
        return None

def calculate_payback_period(initial_investment: float, cash_flows: List[float]) -> Optional[float]:
    """Calculate Payback Period"""
    cumulative = 0
    for i, cf in enumerate(cash_flows):
        cumulative += cf
        if cumulative >= initial_investment:
            # Linear interpolation for more accurate payback period
            prev_cumulative = cumulative - cf
            fraction = (initial_investment - prev_cumulative) / cf
            return i + fraction
    return None

@router.post("/projects/{project_id}/financials")
async def calculate_financial_metrics(
    project_id: int,
    input_data: FinancialInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Calculate financial metrics for a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Prepare cash flows array (initial investment as negative)
    cash_flows = [-input_data.initial_investment] + input_data.cash_flows
    
    # Calculate metrics
    roi = calculate_roi(input_data.initial_investment, sum(input_data.cash_flows))
    npv = calculate_npv(cash_flows, input_data.discount_rate)
    irr = calculate_irr(cash_flows)
    payback = calculate_payback_period(input_data.initial_investment, input_data.cash_flows)
    
    metrics = {
        "roi": round(roi, 2),
        "npv": npv,
        "irr": irr,
        "payback_period": round(payback, 2) if payback else None,
        "details": {
            "total_investment": input_data.initial_investment,
            "total_returns": sum(input_data.cash_flows),
            "discount_rate": input_data.discount_rate,
        }
    }
    
    # Update project financial metrics
    project.financial_metrics = metrics
    db.commit()
    
    return metrics

@router.post("/projects/{project_id}/budget/track")
async def track_budget(
    project_id: int,
    update: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Track actual costs against budget"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Initialize budget tracking if not exists
    if not project.budget_tracking:
        project.budget_tracking = {"periods": {}}
    
    # Update budget tracking
    if update.period not in project.budget_tracking["periods"]:
        project.budget_tracking["periods"][update.period] = {
            "actual": 0,
            "categories": {}
        }
    
    period_data = project.budget_tracking["periods"][update.period]
    
    # Update category costs
    if update.category not in period_data["categories"]:
        period_data["categories"][update.category] = 0
    
    period_data["categories"][update.category] += update.actual_cost
    period_data["actual"] += update.actual_cost
    
    # Update total actual cost
    project.actual_cost = project.actual_cost or 0
    project.actual_cost += update.actual_cost
    
    # Calculate variance
    if project.initial_budget:
        variance = float(project.initial_budget) - float(project.actual_cost)
        variance_percentage = (variance / float(project.initial_budget)) * 100
        project.budget_tracking["variance"] = {
            "amount": round(variance, 2),
            "percentage": round(variance_percentage, 2)
        }
    
    db.commit()
    
    return {
        "message": "Budget updated successfully",
        "current_period": period_data,
        "total_actual_cost": project.actual_cost,
        "variance": project.budget_tracking.get("variance")
    }

@router.get("/projects/{project_id}/budget/analysis")
async def get_budget_analysis(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Get budget analysis including variance and forecasting"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if not project.budget_tracking:
        raise HTTPException(status_code=400, detail="No budget tracking data available")
    
    # Get all periods and sort them
    periods = sorted(project.budget_tracking["periods"].keys())
    
    # Calculate trend for forecasting
    if len(periods) >= 2:
        costs = [project.budget_tracking["periods"][p]["actual"] for p in periods]
        x = np.arange(len(costs))
        z = np.polyfit(x, costs, 1)
        trend = np.poly1d(z)
        
        # Forecast next 3 periods
        next_periods = len(costs) + np.arange(3)
        forecast = trend(next_periods)
    else:
        forecast = None
    
    # Calculate category-wise analysis
    categories = {}
    total_actual = 0
    
    for period in periods:
        period_data = project.budget_tracking["periods"][period]
        total_actual += period_data["actual"]
        
        for category, amount in period_data["categories"].items():
            if category not in categories:
                categories[category] = {"total": 0, "periods": {}}
            categories[category]["total"] += amount
            categories[category]["periods"][period] = amount
    
    # Calculate category percentages
    for category in categories:
        categories[category]["percentage"] = round(
            (categories[category]["total"] / total_actual) * 100, 2
        )
    
    return {
        "total_budget": project.initial_budget,
        "total_actual": total_actual,
        "variance": project.budget_tracking.get("variance"),
        "category_analysis": categories,
        "periods": periods,
        "forecast": [round(f, 2) for f in forecast] if forecast is not None else None,
        "financial_metrics": project.financial_metrics
    }
