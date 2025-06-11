from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel, Field
import statistics
import math

from database import models
from db import get_db
import schemas
from security import oauth2_scheme, get_current_user

router = APIRouter()

class COCOMOInput(BaseModel):
    size_kloc: float = Field(..., gt=0, description="Size in Kilo Lines of Code")
    mode: str = Field(..., pattern="^(organic|semi-detached|embedded)$", description="Project complexity mode")

class FunctionPointInput(BaseModel):
    ufp: int = Field(..., gt=0, description="Unadjusted Function Points")
    caf: float = Field(..., ge=0.65, le=1.35, description="Complexity Adjustment Factor")

class ExpertJudgmentInput(BaseModel):
    expert_estimates: List[float] = Field(..., min_length=1, description="List of expert estimates")

class DelphiInput(BaseModel):
    expert_estimates: List[float] = Field(..., min_length=3, description="List of expert estimates for Delphi method")
    rounds: int = Field(default=1, description="Number of Delphi rounds")

class RegressionInput(BaseModel):
    size: float = Field(..., gt=0, description="Project size metric")
    historical_data: Optional[List[Dict[str, float]]] = Field(default=None, description="Historical project data")

class ComprehensiveEstimationInput(BaseModel):
    project_name: str = Field(..., description="Project name")
    # COCOMO parameters
    size_kloc: Optional[float] = Field(None, gt=0)
    mode: Optional[str] = Field(None, pattern="^(organic|semi-detached|embedded)$")
    # Function Points parameters
    ufp: Optional[int] = Field(None, gt=0)
    caf: Optional[float] = Field(None, ge=0.65, le=1.35)
    # Expert estimates
    expert_estimates: Optional[List[float]] = Field(None, min_length=1)
    # Regression parameters
    regression_size: Optional[float] = Field(None, gt=0)

class EstimationResult(BaseModel):
    method: str
    estimate: float
    confidence_level: str
    details: Dict

# --- Enhanced Estimation Functions ---

def cocomo_basic(size_kloc: float, mode: str) -> Dict:
    """Enhanced COCOMO Basic model with detailed calculations"""
    modes = {
        "organic": {"a": 2.4, "b": 1.05, "description": "Small, experienced teams"},
        "semi-detached": {"a": 3.0, "b": 1.12, "description": "Medium size, mixed experience"},
        "embedded": {"a": 3.6, "b": 1.20, "description": "Large, complex systems"}
    }
    
    if mode not in modes:
        raise ValueError(f"Invalid mode: {mode}")
    
    coefficients = modes[mode]
    effort = coefficients["a"] * (size_kloc ** coefficients["b"])
    
    # Development time estimate (TDEV)
    tdev = 2.5 * (effort ** 0.38)
    
    # Average team size
    team_size = effort / tdev if tdev > 0 else 1
    
    return {
        "effort_person_months": round(effort, 2),
        "development_time_months": round(tdev, 2),
        "average_team_size": round(team_size, 1),
        "mode_description": coefficients["description"],
        "coefficients": coefficients
    }

def function_points_estimate(ufp: int, caf: float) -> Dict:
    """Enhanced Function Points estimation with productivity metrics"""
    adjusted_fp = ufp * caf
    
    # Industry average productivity (hours per function point)
    productivity_rates = {
        "low": 20,      # Low productivity
        "average": 14,  # Industry average
        "high": 8       # High productivity
    }
    
    estimates = {}
    for level, hours_per_fp in productivity_rates.items():
        total_hours = adjusted_fp * hours_per_fp
        person_months = total_hours / 152  # Assuming 152 hours per person-month
        estimates[f"{level}_productivity"] = {
            "hours": round(total_hours, 1),
            "person_months": round(person_months, 2)
        }
    
    return {
        "unadjusted_fp": ufp,
        "complexity_adjustment_factor": caf,
        "adjusted_fp": round(adjusted_fp, 1),
        "estimates": estimates
    }

def expert_judgment_analysis(estimates: List[float]) -> Dict:
    """Enhanced expert judgment with statistical analysis"""
    if not estimates:
        raise ValueError("No estimates provided")
    
    # Basic statistics
    mean_estimate = statistics.mean(estimates)
    median_estimate = statistics.median(estimates)
    
    # Standard deviation and confidence intervals
    if len(estimates) > 1:
        std_dev = statistics.stdev(estimates)
        variance = statistics.variance(estimates)
        
        # 95% confidence interval (assuming normal distribution)
        margin_error = 1.96 * (std_dev / math.sqrt(len(estimates)))
        confidence_interval = (mean_estimate - margin_error, mean_estimate + margin_error)
    else:
        std_dev = 0
        variance = 0
        confidence_interval = (mean_estimate, mean_estimate)
    
    return {
        "estimates": estimates,
        "count": len(estimates),
        "mean": round(mean_estimate, 2),
        "median": round(median_estimate, 2),
        "standard_deviation": round(std_dev, 2),
        "variance": round(variance, 2),
        "confidence_interval_95": [round(ci, 2) for ci in confidence_interval],
        "min_estimate": min(estimates),
        "max_estimate": max(estimates)
    }

def delphi_method_analysis(estimates: List[float], rounds: int = 1) -> Dict:
    """Enhanced Delphi method with outlier removal and consensus analysis"""
    if len(estimates) < 3:
        raise ValueError("Delphi method requires at least 3 estimates")
    
    processed_estimates = estimates.copy()
    round_results = []
    
    for round_num in range(rounds):
        # Sort estimates
        sorted_estimates = sorted(processed_estimates)
        
        # Remove outliers (extreme 10% on each end)
        remove_count = max(1, len(sorted_estimates) // 10)
        if len(sorted_estimates) > 2 * remove_count:
            trimmed_estimates = sorted_estimates[remove_count:-remove_count]
        else:
            trimmed_estimates = sorted_estimates
        
        # Calculate statistics for this round
        mean_estimate = statistics.mean(trimmed_estimates)
        consensus_level = 1 - (statistics.stdev(trimmed_estimates) / mean_estimate) if mean_estimate > 0 else 0
        
        round_results.append({
            "round": round_num + 1,
            "original_count": len(processed_estimates),
            "trimmed_count": len(trimmed_estimates),
            "removed_outliers": len(processed_estimates) - len(trimmed_estimates),
            "mean": round(mean_estimate, 2),
            "consensus_level": round(min(consensus_level, 1.0), 3)
        })
        
        # For multiple rounds, use the trimmed estimates for the next round
        processed_estimates = trimmed_estimates
    
    final_result = round_results[-1]
    
    return {
        "original_estimates": estimates,
        "final_estimate": final_result["mean"],
        "consensus_level": final_result["consensus_level"],
        "rounds": round_results,
        "confidence": "High" if final_result["consensus_level"] > 0.8 else "Medium" if final_result["consensus_level"] > 0.6 else "Low"
    }

def regression_analysis_estimate(size: float, historical_data: Optional[List[Dict[str, float]]] = None) -> Dict:
    """Enhanced regression analysis with correlation metrics"""
    
    # Default regression model if no historical data provided
    if not historical_data:
        # Simple linear model: Effort = 1.2 + 0.35 * Size
        intercept = 1.2
        slope = 0.35
        r_squared = 0.75  # Assumed R-squared value
        
        effort = intercept + slope * size
        
        return {
            "model_type": "Default Linear Regression",
            "intercept": intercept,
            "slope": slope,
            "r_squared": r_squared,
            "input_size": size,
            "estimated_effort": round(effort, 2),
            "equation": f"Effort = {intercept} + {slope} * Size",
            "data_points": 0
        }
    
    # If historical data is provided, calculate actual regression
    if len(historical_data) < 2:
        raise ValueError("At least 2 historical data points required for regression")
    
    sizes = [point.get("size", 0) for point in historical_data]
    efforts = [point.get("effort", 0) for point in historical_data]
    
    n = len(sizes)
    sum_x = sum(sizes)
    sum_y = sum(efforts)
    sum_xy = sum(x * y for x, y in zip(sizes, efforts))
    sum_x2 = sum(x * x for x in sizes)
    sum_y2 = sum(y * y for y in efforts)
    
    # Calculate slope and intercept
    slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
    intercept = (sum_y - slope * sum_x) / n
    
    # Calculate R-squared
    y_mean = sum_y / n
    ss_tot = sum((y - y_mean) ** 2 for y in efforts)
    ss_res = sum((y - (intercept + slope * x)) ** 2 for x, y in zip(sizes, efforts))
    r_squared = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    # Estimate effort for given size
    effort = intercept + slope * size
    
    return {
        "model_type": "Custom Linear Regression",
        "intercept": round(intercept, 3),
        "slope": round(slope, 3),
        "r_squared": round(r_squared, 3),
        "input_size": size,
        "estimated_effort": round(effort, 2),
        "equation": f"Effort = {round(intercept, 3)} + {round(slope, 3)} * Size",
        "data_points": n,
        "historical_data": historical_data
    }

# --- Enhanced API Endpoints ---

@router.post("/cocomo")
def estimate_cocomo(input: COCOMOInput):
    """Enhanced COCOMO estimation with detailed analysis"""
    try:
        result = cocomo_basic(input.size_kloc, input.mode)
        return {
            "model": "COCOMO Basic",
            "input": input.dict(),
            "result": result,
            "success": True
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/function_points")
def estimate_fp(input: FunctionPointInput):
    """Enhanced Function Points estimation with productivity analysis"""
    try:
        result = function_points_estimate(input.ufp, input.caf)
        return {
            "model": "Function Points",
            "input": input.dict(),
            "result": result,
            "success": True
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/expert_judgment")
def estimate_expert(input: ExpertJudgmentInput):
    """Enhanced Expert Judgment with statistical analysis"""
    try:
        result = expert_judgment_analysis(input.expert_estimates)
        return {
            "model": "Expert Judgment",
            "input": input.dict(),
            "result": result,
            "success": True
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/delphi")
def estimate_delphi(input: DelphiInput):
    """Enhanced Delphi Method with consensus analysis"""
    try:
        result = delphi_method_analysis(input.expert_estimates, input.rounds)
        return {
            "model": "Delphi Method",
            "input": input.dict(),
            "result": result,
            "success": True
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/regression")
def estimate_regression(input: RegressionInput):
    """Enhanced Regression Analysis with correlation metrics"""
    try:
        result = regression_analysis_estimate(input.size, input.historical_data)
        return {
            "model": "Regression Analysis",
            "input": input.dict(),
            "result": result,
            "success": True
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/comprehensive")
def estimate_comprehensive(input: ComprehensiveEstimationInput):
    """Comprehensive estimation using all available methods"""
    results = {}
    
    # COCOMO estimation
    if input.size_kloc and input.mode:
        try:
            results["cocomo"] = cocomo_basic(input.size_kloc, input.mode)
        except Exception as e:
            results["cocomo"] = {"error": str(e)}
    
    # Function Points estimation
    if input.ufp and input.caf:
        try:
            results["function_points"] = function_points_estimate(input.ufp, input.caf)
        except Exception as e:
            results["function_points"] = {"error": str(e)}
    
    # Expert Judgment estimation
    if input.expert_estimates and len(input.expert_estimates) > 0:
        try:
            results["expert_judgment"] = expert_judgment_analysis(input.expert_estimates)
            # Also calculate Delphi if enough estimates
            if len(input.expert_estimates) >= 3:
                results["delphi"] = delphi_method_analysis(input.expert_estimates)
        except Exception as e:
            results["expert_judgment"] = {"error": str(e)}
    
    # Regression estimation
    if input.regression_size:
        try:
            results["regression"] = regression_analysis_estimate(input.regression_size)
        except Exception as e:
            results["regression"] = {"error": str(e)}
    
    # Calculate summary statistics if multiple methods available
    valid_estimates = []
    for method, result in results.items():
        if isinstance(result, dict) and "error" not in result:
            if method == "cocomo":
                valid_estimates.append(result.get("effort_person_months", 0))
            elif method == "function_points":
                # Use average productivity estimate
                avg_estimate = result.get("estimates", {}).get("average_productivity", {}).get("person_months", 0)
                valid_estimates.append(avg_estimate)
            elif method == "expert_judgment":
                valid_estimates.append(result.get("mean", 0))
            elif method == "delphi":
                valid_estimates.append(result.get("final_estimate", 0))
            elif method == "regression":
                valid_estimates.append(result.get("estimated_effort", 0))
    
    summary = {}
    if valid_estimates:
        summary = {
            "methods_used": len(valid_estimates),
            "estimates": valid_estimates,
            "average_estimate": round(sum(valid_estimates) / len(valid_estimates), 2),
            "min_estimate": min(valid_estimates),
            "max_estimate": max(valid_estimates),
            "estimate_range": round(max(valid_estimates) - min(valid_estimates), 2)
        }
    
    return {
        "project_name": input.project_name,
        "estimation_methods": results,
        "summary": summary,
        "success": True
    }

@router.post("/projects/", response_model=schemas.Project)
async def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """
    Create a new project with cost estimations
    """    # Calculate all estimates
    estimates = {
        "COCOMO": cocomo_basic(
            project.attributes["size_kloc"],
            project.attributes["mode"]
        ),
        "Function Points": function_points_estimate(
            project.attributes["ufp"],
            project.attributes["caf"]
        ),
        "Expert Judgment": expert_judgment_analysis(
            project.attributes["expert_estimates"]
        ),
        "Delphi Method": delphi_method_analysis(
            project.attributes["expert_estimates"]
        ),
        "Regression Analysis": regression_analysis_estimate(
            project.attributes["regression_size"]
        )
    }
    
    # Create new project in database
    db_project = models.Project(
        name=project.name,
        description=project.description,
        attributes=project.attributes,
        estimates=estimates,
        user_id=current_user.id
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return db_project

@router.get("/projects/", response_model=List[schemas.Project])
async def get_user_projects(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """
    Get all projects for the current user
    """
    return db.query(models.Project).filter(models.Project.user_id == current_user.id).all()