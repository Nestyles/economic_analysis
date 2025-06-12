from typing import List, Dict, Optional, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import numpy as np
from datetime import datetime, timedelta
import json

from database import models
from db import get_db
from security import get_current_user

router = APIRouter()

class ResourceInput(BaseModel):
    id: str
    name: str
    type: str  # 'human', 'equipment', 'material'
    capacity: float  # hours per day
    cost_per_hour: float
    availability: Dict[str, Any]  # start_date, end_date, daily_hours

class TaskInput(BaseModel):
    id: str
    name: str
    duration: float  # hours
    required_resources: List[Dict[str, Any]]  # resource_id, quantity
    dependencies: List[str]
    priority: str  # 'low', 'medium', 'high', 'critical'

class OptimizationScenario(BaseModel):
    name: str
    objective: str  # 'minimize_cost', 'minimize_duration', 'balance_resources', 'maximize_utilization'
    constraints: Dict[str, Any]
    weights: Dict[str, float]

class OptimizationInput(BaseModel):
    resources: List[ResourceInput]
    tasks: List[TaskInput]
    scenario: OptimizationScenario
    project_start_date: str

class ResourceLevelingInput(BaseModel):
    resources: List[ResourceInput]
    tasks: List[TaskInput]
    project_start_date: str

class ResourceSmoothingInput(BaseModel):
    resources: List[ResourceInput]
    tasks: List[TaskInput]
    project_start_date: str

class ResourceAllocationInput(BaseModel):
    resources: List[ResourceInput]
    tasks: List[TaskInput]
    scenario: OptimizationScenario
    project_start_date: str

class ScenarioAnalysisInput(BaseModel):
    base_scenario: OptimizationInput
    variations: Dict[str, Dict[str, float]]  # scenario_name -> {param: factor}

def resource_leveling_algorithm(tasks: List[TaskInput], resources: List[ResourceInput], start_date: datetime) -> Dict:
    """
    Resource leveling algorithm - delays non-critical tasks to resolve resource over-allocations
    while maintaining the project end date
    """
    # Build dependency graph and calculate critical path
    task_dict = {task.id: task for task in tasks}
    resource_dict = {res.id: res for res in resources}
    
    # Calculate earliest start times using forward pass
    earliest_start = {}
    earliest_finish = {}
    
    def calculate_earliest_times(task_id: str, visited: set):
        if task_id in visited:
            return earliest_finish.get(task_id, 0)
        visited.add(task_id)
        
        task = task_dict[task_id]
        max_predecessor_finish = 0
        
        for dep_id in task.dependencies:
            if dep_id in task_dict:
                dep_finish = calculate_earliest_times(dep_id, visited)
                max_predecessor_finish = max(max_predecessor_finish, dep_finish)
        
        earliest_start[task_id] = max_predecessor_finish
        earliest_finish[task_id] = max_predecessor_finish + task.duration
        return earliest_finish[task_id]
    
    # Calculate for all tasks
    for task in tasks:
        calculate_earliest_times(task.id, set())
    
    # Calculate latest start times using backward pass
    project_end = max(earliest_finish.values()) if earliest_finish else 0
    latest_start = {}
    latest_finish = {}
    
    def calculate_latest_times(task_id: str, visited: set):
        if task_id in visited:
            return latest_start.get(task_id, project_end)
        visited.add(task_id)
        
        task = task_dict[task_id]
        min_successor_start = project_end
        
        # Find all tasks that depend on this task
        for other_task in tasks:
            if task_id in other_task.dependencies:
                successor_start = calculate_latest_times(other_task.id, visited)
                min_successor_start = min(min_successor_start, successor_start)
        
        latest_finish[task_id] = min_successor_start
        latest_start[task_id] = min_successor_start - task.duration
        return latest_start[task_id]
    
    # Calculate for all tasks
    for task in tasks:
        calculate_latest_times(task.id, set())
    
    # Identify critical path
    critical_tasks = []
    for task in tasks:
        if abs(earliest_start[task.id] - latest_start[task.id]) < 0.001:  # Float precision
            critical_tasks.append(task.id)
    
    # Resource leveling: adjust non-critical tasks to smooth resource usage
    schedule = {}
    resource_usage = {}
    
    # Sort tasks by priority and float (non-critical first for adjustment)
    def task_priority(task):
        is_critical = task.id in critical_tasks
        priority_map = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
        return (is_critical, priority_map.get(task.priority, 2), earliest_start[task.id])
    
    sorted_tasks = sorted(tasks, key=task_priority)
    
    for task in sorted_tasks:
        # Find required resources
        task_resources = {}
        for req in task.required_resources:
            if req['resource_id'] in resource_dict:
                task_resources[req['resource_id']] = req['quantity']
        
        # Find optimal start time within float
        min_start = earliest_start[task.id]
        max_start = latest_start[task.id]
        
        best_start = min_start
        min_peak_usage = float('inf')
        
        # Try different start times within the float
        for start_offset in range(int(max_start - min_start) + 1):
            candidate_start = min_start + start_offset
            candidate_end = candidate_start + task.duration
            
            # Calculate resource usage for this time slot
            peak_usage = 0
            conflict = False
            
            for res_id, quantity in task_resources.items():
                resource = resource_dict[res_id]
                for hour in range(int(task.duration)):
                    time_slot = candidate_start + hour
                    current_usage = resource_usage.get(res_id, {}).get(time_slot, 0)
                    new_usage = current_usage + quantity
                    
                    if new_usage > resource.capacity:
                        conflict = True
                        break
                    peak_usage = max(peak_usage, new_usage)
                
                if conflict:
                    break
            
            if not conflict and peak_usage < min_peak_usage:
                min_peak_usage = peak_usage
                best_start = candidate_start
        
        # Schedule the task
        schedule[task.id] = {
            'start_time': start_date + timedelta(hours=best_start),
            'end_time': start_date + timedelta(hours=best_start + task.duration),
            'duration': task.duration,
            'is_critical': task.id in critical_tasks,
            'float': latest_start[task.id] - earliest_start[task.id]
        }
        
        # Update resource usage
        for res_id, quantity in task_resources.items():
            if res_id not in resource_usage:
                resource_usage[res_id] = {}
            for hour in range(int(task.duration)):
                time_slot = best_start + hour
                resource_usage[res_id][time_slot] = resource_usage[res_id].get(time_slot, 0) + quantity
      # Calculate project duration as hours (JSON-serializable)
    project_end_time = max(schedule[task.id]['end_time'] for task in tasks if task.id in schedule)
    project_duration_hours = (project_end_time - start_date).total_seconds() / 3600
    
    return {
        'leveled_tasks': [
            {
                **task.dict(),
                'earliest_start': schedule[task.id]['start_time'].isoformat(),
                'latest_finish': schedule[task.id]['end_time'].isoformat(),
                'is_critical': schedule[task.id]['is_critical'],
                'float': schedule[task.id]['float']
            }
            for task in tasks
        ],
        'critical_path': critical_tasks,
        'resource_usage': resource_usage,
        'project_duration_hours': project_duration_hours,
        'project_start_date': start_date.isoformat(),
        'project_end_date': project_end_time.isoformat()
    }

def resource_smoothing_algorithm(tasks: List[TaskInput], resources: List[ResourceInput], start_date: datetime) -> Dict:
    """
    Resource smoothing algorithm - reduces peak resource requirements by extending 
    the project duration within available float
    """
    # First, get the leveled schedule
    leveled_result = resource_leveling_algorithm(tasks, resources, start_date)
    task_dict = {task.id: task for task in tasks}
    resource_dict = {res.id: res for res in resources}
    
    # Analyze resource usage patterns
    resource_usage = leveled_result['resource_usage']
    
    # Find peak usage periods for each resource
    resource_peaks = {}
    for res_id, usage in resource_usage.items():
        if not usage:
            continue
        max_usage = max(usage.values())
        resource_peaks[res_id] = {
            'peak_usage': max_usage,
            'capacity': resource_dict[res_id].capacity,
            'utilization': max_usage / resource_dict[res_id].capacity
        }
    
    # Smooth resources by delaying non-critical tasks
    smoothed_schedule = {}
    smoothed_usage = {}
    
    # Re-schedule tasks with smoothing objective
    for task in tasks:
        task_resources = {}
        for req in task.required_resources:
            if req['resource_id'] in resource_dict:
                task_resources[req['resource_id']] = req['quantity']
        
        # Find the time slot with minimum resource contention
        best_start = leveled_result['leveled_tasks'][0]['earliest_start']  # Default
        min_contention = float('inf')
          # Try different start times (more flexible for smoothing)
        # Use the duration in hours from leveled result
        max_project_hours = int(leveled_result['project_duration_hours'])
        for start_offset in range(0, max_project_hours):
            candidate_start = start_offset
            total_contention = 0
            
            for res_id, quantity in task_resources.items():
                resource = resource_dict[res_id]
                for hour in range(int(task.duration)):
                    time_slot = candidate_start + hour
                    current_usage = smoothed_usage.get(res_id, {}).get(time_slot, 0)
                    new_usage = current_usage + quantity
                    
                    # Calculate contention as usage above target utilization (70%)
                    target_utilization = 0.7
                    if new_usage > resource.capacity * target_utilization:
                        total_contention += (new_usage - resource.capacity * target_utilization)
            
            if total_contention < min_contention:
                min_contention = total_contention
                best_start = candidate_start
        
        # Schedule the task
        smoothed_schedule[task.id] = {
            'start_time': start_date + timedelta(hours=best_start),
            'end_time': start_date + timedelta(hours=best_start + task.duration),
            'duration': task.duration
        }
        
        # Update resource usage
        for res_id, quantity in task_resources.items():
            if res_id not in smoothed_usage:
                smoothed_usage[res_id] = {}
            for hour in range(int(task.duration)):
                time_slot = best_start + hour
                smoothed_usage[res_id][time_slot] = smoothed_usage[res_id].get(time_slot, 0) + quantity
    
    # Calculate new resource utilization
    smoothed_peaks = {}
    for res_id, usage in smoothed_usage.items():
        if usage:
            max_usage = max(usage.values())
            smoothed_peaks[res_id] = {
                'peak_usage': max_usage,
                'capacity': resource_dict[res_id].capacity,
                'utilization': max_usage / resource_dict[res_id].capacity
            }
      # Calculate project duration as hours (JSON-serializable)
    project_end_time = max(smoothed_schedule[task.id]['end_time'] for task in tasks if task.id in smoothed_schedule)
    project_duration_hours = (project_end_time - start_date).total_seconds() / 3600
    
    return {
        'smoothed_tasks': [
            {
                **task.dict(),
                'earliest_start': smoothed_schedule[task.id]['start_time'].isoformat(),
                'latest_finish': smoothed_schedule[task.id]['end_time'].isoformat()
            }
            for task in tasks
        ],
        'original_peaks': resource_peaks,
        'smoothed_peaks': smoothed_peaks,
        'resource_usage': smoothed_usage,
        'project_duration_hours': project_duration_hours,
        'project_start_date': start_date.isoformat(),
        'project_end_date': project_end_time.isoformat()
    }

def optimize_resource_allocation(input_data: OptimizationInput) -> Dict:
    """
    Comprehensive resource optimization based on scenario objectives
    """
    start_date = datetime.fromisoformat(input_data.project_start_date)
    scenario = input_data.scenario
    
    # Calculate baseline metrics
    total_estimated_cost = 0
    total_duration = 0
    resource_requirements = {}
    
    for task in input_data.tasks:
        total_duration += task.duration
        for req in task.required_resources:
            resource = next((r for r in input_data.resources if r.id == req['resource_id']), None)
            if resource:
                task_cost = task.duration * resource.cost_per_hour * req['quantity']
                total_estimated_cost += task_cost
                
                if req['resource_id'] not in resource_requirements:
                    resource_requirements[req['resource_id']] = 0
                resource_requirements[req['resource_id']] += req['quantity']
    
    # Apply resource leveling first
    leveled_result = resource_leveling_algorithm(input_data.tasks, input_data.resources, start_date)
    
    # Calculate optimized schedule based on objective
    if scenario.objective == 'minimize_cost':
        # Prioritize cheaper resources and minimize overtime
        optimized_cost = total_estimated_cost * 0.85  # Assume 15% cost reduction
        recommendations = [
            "Consider using lower-cost resources where skills permit",
            "Minimize overtime and peak resource usage",
            "Schedule non-critical tasks during off-peak periods"
        ]
    elif scenario.objective == 'minimize_duration':
        # Parallel execution and resource-intensive approach
        optimized_duration = total_duration * 0.75  # Assume 25% duration reduction
        recommendations = [
            "Maximize parallel task execution",
            "Consider additional resources for critical path",
            "Reduce task dependencies where possible"
        ]
    elif scenario.objective == 'balance_resources':
        # Apply smoothing for balanced utilization
        smoothed_result = resource_smoothing_algorithm(input_data.tasks, input_data.resources, start_date)
        recommendations = [
            "Balance resource utilization across project timeline",
            "Avoid resource peaks and troughs",
            "Consider flexible task scheduling within float"
        ]
    else:  # maximize_utilization
        # Aim for high but sustainable utilization
        recommendations = [
            "Maximize resource utilization while avoiding overallocation",
            "Consider cross-training for resource flexibility",
            "Schedule buffer time for unexpected delays"
        ]
    
    # Calculate resource utilization
    resource_utilization = {}
    for resource in input_data.resources:
        total_capacity = resource.capacity * len(input_data.tasks)  # Simplified
        used_capacity = resource_requirements.get(resource.id, 0)
        resource_utilization[resource.id] = min(used_capacity / total_capacity, 1.0) if total_capacity > 0 else 0
    
    # Identify conflicts (simplified)
    resource_conflicts = []
    for res_id, peak_data in leveled_result.get('resource_usage', {}).items():
        resource = next((r for r in input_data.resources if r.id == res_id), None)
        if resource and peak_data:
            max_usage = max(peak_data.values()) if peak_data else 0
            if max_usage > resource.capacity:
                resource_conflicts.append({
                    'resource_id': res_id,
                    'over_allocation_periods': [{
                        'start': start_date.isoformat(),
                        'end': (start_date + timedelta(hours=24)).isoformat(),
                        'excess': max_usage - resource.capacity
                    }]
                })
    
    # Create allocation results
    allocations = []
    for task in input_data.tasks:
        for req in task.required_resources:
            resource = next((r for r in input_data.resources if r.id == req['resource_id']), None)
            if resource:
                allocations.append({
                    'task_id': task.id,
                    'resource_id': req['resource_id'],
                    'start_date': start_date.isoformat(),
                    'end_date': (start_date + timedelta(hours=task.duration)).isoformat(),
                    'hours_allocated': task.duration * req['quantity'],
                    'cost': task.duration * resource.cost_per_hour * req['quantity']
                })
    
    return {
        'scenario_name': scenario.name,
        'total_cost': total_estimated_cost,
        'total_duration': sum(task.duration for task in input_data.tasks),
        'resource_utilization': resource_utilization,
        'allocations': allocations,
        'critical_path': leveled_result.get('critical_path', []),
        'resource_conflicts': resource_conflicts,
        'recommendations': recommendations
    }

@router.post("/{project_id}/resources/optimize")
async def optimize_resources(
    project_id: int,
    input_data: OptimizationInput,
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
    leveling_results = resource_leveling_algorithm(input_data.tasks, input_data.resources, 
                                                 datetime.fromisoformat(input_data.project_start_date))
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

# Add missing endpoints for resource leveling and smoothing

@router.post("/{project_id}/leveling")
async def resource_leveling(
    project_id: int,
    input_data: ResourceLevelingInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Apply resource leveling algorithm to a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Run resource leveling
    leveling_results = resource_leveling_algorithm(
        input_data.tasks, 
        input_data.resources, 
        datetime.fromisoformat(input_data.project_start_date)
    )
    
    # Store results in project
    if not project.resource_allocation:
        project.resource_allocation = {}
    project.resource_allocation['leveling'] = leveling_results
    db.commit()
    
    return leveling_results

@router.post("/{project_id}/smoothing")
async def resource_smoothing(
    project_id: int,
    input_data: ResourceSmoothingInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Apply resource smoothing algorithm to a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Run resource smoothing
    smoothing_results = resource_smoothing_algorithm(
        input_data.tasks, 
        input_data.resources, 
        datetime.fromisoformat(input_data.project_start_date)
    )
    
    # Store results in project
    if not project.resource_allocation:
        project.resource_allocation = {}
    project.resource_allocation['smoothing'] = smoothing_results
    db.commit()
    
    return smoothing_results

@router.post("/{project_id}/optimize")
async def optimize_resource_allocation_simple(
    project_id: int,
    input_data: OptimizationInput,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Simple resource optimization endpoint for direct optimization calls"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Run optimization
    optimization_results = optimize_resource_allocation(input_data)
    
    # Store results in project
    if not project.resource_allocation:
        project.resource_allocation = {}
    project.resource_allocation['optimization'] = optimization_results
    db.commit()
    
    return optimization_results
