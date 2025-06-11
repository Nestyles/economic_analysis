from typing import List
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class COCOMOInput(BaseModel):
    size_kloc: float  # Size in Kilo Lines of Code
    mode: str  # 'organic', 'semi-detached', 'embedded'

class FunctionPointInput(BaseModel):
    ufp: int  # Unadjusted Function Points
    caf: float  # Complexity Adjustment Factor

class ExpertJudgmentInput(BaseModel):
    expert_estimates: List[float]

class DelphiInput(BaseModel):
    expert_estimates: List[float]

class RegressionInput(BaseModel):
    size: float  # e.g., lines of code or function points

class ProjectAttributes(BaseModel):
    size_kloc: float
    mode: str
    ufp: int
    caf: float
    expert_estimates: List[float]
    regression_size: float

# --- Estimation Functions ---

def cocomo_basic(size_kloc: float, mode: str) -> float:
    # Basic COCOMO coefficients
    modes = {
        "organic": (2.4, 1.05),
        "semi-detached": (3.0, 1.12),
        "embedded": (3.6, 1.20)
    }
    if mode not in modes:
        raise ValueError("Invalid mode")
    a, b = modes[mode]
    effort = a * (size_kloc ** b)
    return effort  # Person-months

def function_points(ufp: int, caf: float) -> float:
    return ufp * caf  # Adjusted Function Points

def expert_judgment(estimates: List[float]) -> float:
    return sum(estimates) / len(estimates) if estimates else 0

def delphi_method(estimates: List[float]) -> float:
    # Simple average for demonstration
    return sum(estimates) / len(estimates) if estimates else 0

def regression_analysis(size: float) -> float:
    # Example: Effort = 5 + 0.1 * size
    return 5 + 0.1 * size

# --- API Endpoints ---

@router.post("/cocomo")
def estimate_cocomo(input: COCOMOInput):
    effort = cocomo_basic(input.size_kloc, input.mode)
    return {"model": "COCOMO", "effort_person_months": effort}

@router.post("/function_points")
def estimate_fp(input: FunctionPointInput):
    fp = function_points(input.ufp, input.caf)
    return {"model": "Function Points", "adjusted_fp": fp}

@router.post("/expert_judgment")
def estimate_expert(input: ExpertJudgmentInput):
    estimate = expert_judgment(input.expert_estimates)
    return {"model": "Expert Judgment", "estimate": estimate}

@router.post("/delphi")
def estimate_delphi(input: DelphiInput):
    estimate = delphi_method(input.expert_estimates)
    return {"model": "Delphi Method", "estimate": estimate}

@router.post("/regression")
def estimate_regression(input: RegressionInput):
    estimate = regression_analysis(input.size)
    return {"model": "Regression Analysis", "estimate": estimate}

@router.post("/")
def estimate_all(input: ProjectAttributes):
    results = {
        "COCOMO": cocomo_basic(input.size_kloc, input.mode),
        "Function Points": function_points(input.ufp, input.caf),
        "Expert Judgment": expert_judgment(input.expert_estimates),
        "Delphi Method": delphi_method(input.expert_estimates),
        "Regression Analysis": regression_analysis(input.regression_size)
    }
    return results