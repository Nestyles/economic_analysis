from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import numpy as np
from datetime import datetime, timedelta
from pulp import *

from database import models
from db import get_db
from security import get_current_user

router = APIRouter()

class Resource(BaseModel):
    id: str
    name: str
    cost_per_hour: float
    max_hours_per_day: float = Field(default=8.0)
    skills: List[str]

class Task(BaseModel):
    id: str
    name: str
    duration_hours: float
    required_skills: List[str]
    dependencies: Optional[List[str]] = None
    earliest_start: Optional[datetime] = None
    deadline: Optional[datetime] = None

class ResourceAllocationInput(BaseModel):
    resources: List[Resource]
    tasks: List[Task]
    start_date: datetime
    optimization_objective: str = Field(
        default="cost",
        description="Optimization objective: 'cost', 'duration', or 'balanced'"
    )

class ScenarioAnalysisInput(BaseModel):
    base_scenario: ResourceAllocationInput
    variations: Dict[str, Dict[str, float]] = Field(
        description="Variations in parameters for different scenarios"
    )

def resource_leveling(tasks: List[Task], resources: List[Resource]) -> Dict:
    """Implement resource leveling algorithm"""
    # Initialize schedule
    schedule = {}
    resource_usage = {}
    
    # Sort tasks by dependencies (simple topological sort)
    task_deps = {task.id: set(task.dependencies or []) for task in tasks}
    scheduled = set()
    
    while len(scheduled) < len(tasks):
        # Find tasks with all dependencies scheduled
        available = [
            task for task in tasks
            if task.id not in scheduled and
            all(dep in scheduled for dep in (task.dependencies or []))
        ]
        
        if not available:
            raise ValueError("Circular dependency detected")
        
        for task in available:
            # Find suitable resources
            suitable_resources = [
                r for r in resources
                if all(skill in r.skills for skill in task.required_skills)
            ]
            
            if not suitable_resources:
                raise ValueError(f"No suitable resources for task {task.id}")
            
            # Find earliest possible start time
            earliest_start = task.earliest_start or datetime.min
            for dep in (task.dependencies or []):
                dep_end = schedule[dep]["end_time"]
                earliest_start = max(earliest_start, dep_end)
            
            # Schedule task with resource leveling
            best_start = earliest_start
            best_resource = None
            min_peak_usage = float('inf')
            
            for resource in suitable_resources:
                # Try different start times
                for start in [earliest_start + timedelta(hours=h) for h in range(24)]:
                    end = start + timedelta(hours=task.duration_hours)
                    
                    # Check resource usage
                    if resource.id not in resource_usage:
                        resource_usage[resource.id] = {}
                    
                    peak_usage = 0
                    conflict = False
                    
                    for hour in range(int(task.duration_hours)):
                        time_slot = start + timedelta(hours=hour)
                        current_usage = resource_usage[resource.id].get(time_slot, 0)
                        if current_usage + 1 > resource.max_hours_per_day:
                            conflict = True
                            break
                        peak_usage = max(peak_usage, current_usage + 1)
                    
                    if not conflict and peak_usage < min_peak_usage:
                        min_peak_usage = peak_usage
                        best_start = start
                        best_resource = resource
            
            # Schedule task with best resource and start time
            end_time = best_start + timedelta(hours=task.duration_hours)
            schedule[task.id] = {
                "start_time": best_start,
                "end_time": end_time,
                "resource": best_resource.id
            }
            
            # Update resource usage
            for hour in range(int(task.duration_hours)):
                time_slot = best_start + timedelta(hours=hour)
                if time_slot not in resource_usage[best_resource.id]:
                    resource_usage[best_resource.id][time_slot] = 0
                resource_usage[best_resource.id][time_slot] += 1
            
            scheduled.add(task.id)
    
    return {
        "schedule": schedule,
        "resource_usage": resource_usage
    }

def optimize_resource_allocation(input_data: ResourceAllocationInput) -> Dict:
    """Optimize resource allocation using linear programming"""
    # Create optimization problem
    prob = LpProblem("ResourceAllocation", LpMinimize)
    
    # Create variables
    assignments = LpVariable.dicts(
        "assign",
        ((t.id, r.id) for t in input_data.tasks for r in input_data.resources),
        cat='Binary'
    )
    
    # Objective function
    if input_data.optimization_objective == "cost":
        prob += lpSum(
            assignments[t.id, r.id] * t.duration_hours * r.cost_per_hour
            for t in input_data.tasks
            for r in input_data.resources
        )
    elif input_data.optimization_objective == "duration":
        makespan = LpVariable("makespan", lowBound=0)
        for task in input_data.tasks:
            prob += makespan >= lpSum(
                assignments[task.id, r.id] * task.duration_hours
                for r in input_data.resources
            )
        prob += makespan
    else:  # balanced
        cost_weight = 0.5
        duration_weight = 0.5
        total_cost = lpSum(
            assignments[t.id, r.id] * t.duration_hours * r.cost_per_hour
            for t in input_data.tasks
            for r in input_data.resources
        )
        makespan = LpVariable("makespan", lowBound=0)
        prob += cost_weight * total_cost + duration_weight * makespan
    
    # Constraints
    # Each task must be assigned to exactly one resource
    for task in input_data.tasks:
        prob += lpSum(
            assignments[task.id, r.id]
            for r in input_data.resources
        ) == 1
    
    # Resource skill requirements
    for task in input_data.tasks:
        for resource in input_data.resources:
            if not all(skill in resource.skills for skill in task.required_skills):
                prob += assignments[task.id, resource.id] == 0
    
    # Solve the problem
    prob.solve()
    
    # Extract results
    schedule = {}
    for task in input_data.tasks:
        for resource in input_data.resources:
            if assignments[task.id, resource.id].value() == 1:
                schedule[task.id] = {
                    "resource": resource.id,
                    "start_time": input_data.start_date,
                    "duration_hours": task.duration_hours
                }
    
    return {
        "status": LpStatus[prob.status],
        "objective_value": value(prob.objective),
        "schedule": schedule
    }

@router.post("/{project_id}/resources/optimize")
async def optimize_resources(
    project_id: int,
    input_data: ResourceAllocationInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Optimize resource allocation for a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Run both resource leveling and optimization
    leveling_results = resource_leveling(input_data.tasks, input_data.resources)
    optimization_results = optimize_resource_allocation(input_data)
    
    results = {
        "resource_leveling": leveling_results,
        "optimization": optimization_results
    }
    
    # Store results in project
    if not project.resource_allocation:
        project.resource_allocation = {}
    project.resource_allocation['latest'] = results
    db.commit()
    
    return results

@router.post("/{project_id}/resources/scenarios")
async def analyze_scenarios(
    project_id: int,
    input_data: ScenarioAnalysisInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Analyze different resource allocation scenarios"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Run base scenario
    base_results = optimize_resource_allocation(input_data.base_scenario)
    
    # Run variations
    scenario_results = {
        "base": base_results
    }
    
    for scenario_name, variations in input_data.variations.items():
        # Create modified input data
        modified_input = input_data.base_scenario.copy()
        
        # Apply variations
        for param, factor in variations.items():
            if param == "duration":
                for task in modified_input.tasks:
                    task.duration_hours *= factor
            elif param == "cost":
                for resource in modified_input.resources:
                    resource.cost_per_hour *= factor
        
        # Run optimization for this scenario
        scenario_results[scenario_name] = optimize_resource_allocation(modified_input)
    
    # Store results in project
    if not project.resource_allocation:
        project.resource_allocation = {}
    project.resource_allocation['scenarios'] = scenario_results
    db.commit()
    
    return scenario_results
