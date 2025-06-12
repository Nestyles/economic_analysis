from typing import Any, List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import numpy as np
from scipy import stats
import random

from database import models
from db import get_db
from security import get_current_user

router = APIRouter()

class SensitivityAnalysisInput(BaseModel):
    base_value: float = Field(..., gt=0)
    variables: Dict[str, Dict[str, float]] = Field(
        ...,
        description="Dict of variables with their min and max values"
    )
    iterations: int = Field(default=1000, ge=100, le=10000)

class DecisionTreeNode(BaseModel):
    name: str
    probability: float = Field(..., ge=0, le=1)
    value: float
    children: Optional[List['DecisionTreeNode']] = None

class MonteCarloInput(BaseModel):
    variables: Dict[str, Dict[str, float]]
    iterations: int = Field(default=1000, ge=100, le=10000)
    correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None

class RiskAnalysisResult(BaseModel):
    method: str
    results: Dict[str, Any]
    visualization_data: Dict[str, Any]

def perform_sensitivity_analysis(base_value: float, variables: Dict[str, Dict[str, float]], iterations: int) -> Dict:
    """Perform sensitivity analysis using tornado diagram approach"""
    results = {}
    for var_name, var_range in variables.items():
        # Test variable at min while others at base
        min_value = var_range['min']
        max_value = var_range['max']
        
        # Calculate impact
        min_impact = (min_value - base_value) / base_value * 100
        max_impact = (max_value - base_value) / base_value * 100
        
        results[var_name] = {
            'min_impact': round(min_impact, 2),
            'max_impact': round(max_impact, 2),
            'range': round(max_impact - min_impact, 2)
        }
    
    # Sort by range of impact
    sorted_results = dict(
        sorted(results.items(), key=lambda x: abs(x[1]['range']), reverse=True)
    )
    
    return {
        'base_value': base_value,
        'variables': sorted_results,
        'visualization': {
            'variables': list(sorted_results.keys()),
            'min_impacts': [v['min_impact'] for v in sorted_results.values()],
            'max_impacts': [v['max_impact'] for v in sorted_results.values()]
        }
    }

def evaluate_decision_tree(node: DecisionTreeNode) -> Dict:
    """Recursively evaluate a decision tree node"""
    expected_value = node.value * node.probability
    
    if node.children:
        for child in node.children:
            child_result = evaluate_decision_tree(child)
            expected_value += child_result['expected_value']
    
    return {
        'node': node.name,
        'probability': node.probability,
        'value': node.value,
        'expected_value': expected_value
    }

def monte_carlo_simulation(
    variables: Dict[str, Dict[str, float]],
    iterations: int,
    correlation_matrix: Optional[Dict[str, Dict[str, float]]] = None
) -> Dict:
    """Perform Monte Carlo simulation"""
    results = []
    var_names = list(variables.keys())
    
    # Create correlation matrix if provided
    if correlation_matrix:
        corr_matrix = np.array([[correlation_matrix[v1].get(v2, 0) 
                                for v2 in var_names] 
                                for v1 in var_names])
    else:
        corr_matrix = np.eye(len(var_names))
    
    # Generate correlated random variables
    for _ in range(iterations):
        # Generate correlated standard normal variables
        normal_vars = np.random.multivariate_normal(
            mean=[0] * len(var_names),
            cov=corr_matrix
        )
        
        # Transform to uniform distribution
        uniform_vars = stats.norm.cdf(normal_vars)
        
        # Transform to target distributions
        iteration_result = {}
        for i, var_name in enumerate(var_names):
            var_range = variables[var_name]
            min_val = var_range['min']
            max_val = var_range['max']
            
            # Linear transformation from [0,1] to [min,max]
            value = min_val + uniform_vars[i] * (max_val - min_val)
            iteration_result[var_name] = value
        
        results.append(iteration_result)
    
    # Calculate statistics
    stats_results = {}
    for var_name in var_names:
        values = [r[var_name] for r in results]
        stats_results[var_name] = {
            'mean': np.mean(values),
            'std': np.std(values),
            'percentiles': {
                '10': np.percentile(values, 10),
                '50': np.percentile(values, 50),
                '90': np.percentile(values, 90)
            }
        }
    
    return {
        'iterations': iterations,
        'statistics': stats_results,
        'visualization': {
            'variables': var_names,
            'data': results
        }
    }

@router.post("/{project_id}/risk/sensitivity")
async def run_sensitivity_analysis(
    project_id: int,
    input_data: SensitivityAnalysisInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Run sensitivity analysis for project variables"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    results = perform_sensitivity_analysis(
        input_data.base_value,
        input_data.variables,
        input_data.iterations
    )
    
    # Store results in project
    if not project.risk_analysis:
        project.risk_analysis = {}
    project.risk_analysis['sensitivity'] = results
    db.commit()
    
    return results

@router.post("/{project_id}/risk/decision-tree")
async def analyze_decision_tree(
    project_id: int,
    tree: DecisionTreeNode,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Analyze decision tree for risk assessment"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    results = evaluate_decision_tree(tree)
    
    # Store results in project
    if not project.risk_analysis:
        project.risk_analysis = {}
    project.risk_analysis['decision_tree'] = results
    db.commit()
    
    return results

@router.post("/{project_id}/risk/monte-carlo")
async def run_monte_carlo_simulation(
    project_id: int,
    input_data: MonteCarloInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Run Monte Carlo simulation for uncertainty modeling"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    results = monte_carlo_simulation(
        input_data.variables,
        input_data.iterations,
        input_data.correlation_matrix
    )
    
    # Store results in project
    if not project.risk_analysis:
        project.risk_analysis = {}
    project.risk_analysis['monte_carlo'] = results
    db.commit()
    
    return results
