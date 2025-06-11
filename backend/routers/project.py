from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime

from database import models
from db import get_db
import schemas
from security import get_current_user

# Import estimation functions from cost_estimation router
from routers.cost_estimation import (
    cocomo_basic,
    function_points_estimate,
    expert_judgment_analysis,
    delphi_method_analysis,
    regression_analysis_estimate
)

router = APIRouter()

@router.post("/", response_model=schemas.Project)
async def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Create a new project"""
    db_project = models.Project(
        name=project.name,
        description=project.description,
        user_id=current_user.id,
        attributes={},
        estimates={}
    )
    
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    
    return db_project

@router.get("/", response_model=List[schemas.ProjectSummary])
async def get_user_projects(
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100)
):
    """Get all projects for the current user with summary information"""
    projects = db.query(models.Project).filter(
        models.Project.user_id == current_user.id
    ).offset(skip).limit(limit).all()
    
    project_summaries = []
    for project in projects:
        # Calculate estimated cost from estimates if available
        estimated_cost = None
        estimation_methods_count = 0
        
        if project.estimates:
            estimates_list = []
            if "cocomo" in project.estimates and "effort_person_months" in project.estimates["cocomo"]:
                estimates_list.append(project.estimates["cocomo"]["effort_person_months"])
                estimation_methods_count += 1
            
            if "function_points" in project.estimates and "estimates" in project.estimates["function_points"]:
                fp_avg = project.estimates["function_points"]["estimates"].get("average_productivity", {}).get("person_months")
                if fp_avg:
                    estimates_list.append(fp_avg)
                    estimation_methods_count += 1
            
            if "expert_judgment" in project.estimates and "mean" in project.estimates["expert_judgment"]:
                estimates_list.append(project.estimates["expert_judgment"]["mean"])
                estimation_methods_count += 1
            
            if "delphi" in project.estimates and "final_estimate" in project.estimates["delphi"]:
                estimates_list.append(project.estimates["delphi"]["final_estimate"])
                estimation_methods_count += 1
            
            if "regression" in project.estimates and "estimated_effort" in project.estimates["regression"]:
                estimates_list.append(project.estimates["regression"]["estimated_effort"])
                estimation_methods_count += 1
            
            if estimates_list:
                estimated_cost = sum(estimates_list) / len(estimates_list)
        
        project_summaries.append(schemas.ProjectSummary(
            id=project.id,
            name=project.name,
            description=project.description,
            created_at=project.created_at,
            updated_at=project.updated_at,
            estimated_cost=estimated_cost,
            estimation_methods_count=estimation_methods_count
        ))
    
    return project_summaries

@router.get("/{project_id}", response_model=schemas.Project)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Get a specific project by ID"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project

@router.put("/{project_id}", response_model=schemas.Project)
async def update_project(
    project_id: int,
    project_update: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Update a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project_update.name is not None:
        project.name = project_update.name
    if project_update.description is not None:
        project.description = project_update.description
    
    project.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(project)
    
    return project

@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Delete a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    
    return {"message": "Project deleted successfully"}

@router.post("/{project_id}/estimate")
async def estimate_project_cost(
    project_id: int,
    estimation_input: schemas.EstimationInput,
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Add cost estimation to a project"""
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Perform estimations based on provided inputs
    estimates = {}
    
    try:
        # COCOMO estimation
        if estimation_input.size_kloc and estimation_input.mode:
            estimates["cocomo"] = cocomo_basic(estimation_input.size_kloc, estimation_input.mode)
        
        # Function Points estimation
        if estimation_input.ufp and estimation_input.caf:
            estimates["function_points"] = function_points_estimate(estimation_input.ufp, estimation_input.caf)
        
        # Expert Judgment and Delphi
        if estimation_input.expert_estimates and len(estimation_input.expert_estimates) > 0:
            estimates["expert_judgment"] = expert_judgment_analysis(estimation_input.expert_estimates)
            
            if len(estimation_input.expert_estimates) >= 3:
                estimates["delphi"] = delphi_method_analysis(estimation_input.expert_estimates)
        
        # Regression Analysis
        if estimation_input.regression_size:
            estimates["regression"] = regression_analysis_estimate(estimation_input.regression_size)
        
        # Update project with new estimates and attributes
        project.attributes = estimation_input.dict(exclude_none=True)
        project.estimates = estimates
        project.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(project)
        
        return {
            "project_id": project_id,
            "estimates": estimates,
            "message": "Cost estimation completed successfully"
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error in cost estimation: {str(e)}")

@router.get("/compare/")
async def compare_projects(
    project_ids: List[int] = Query(..., description="List of project IDs to compare"),
    db: Session = Depends(get_db),
    current_user: schemas.User = Depends(get_current_user)
):
    """Compare cost estimations across multiple projects"""
    if len(project_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 projects required for comparison")
    
    projects = db.query(models.Project).filter(
        models.Project.id.in_(project_ids),
        models.Project.user_id == current_user.id
    ).all()
    
    if len(projects) != len(project_ids):
        raise HTTPException(status_code=404, detail="One or more projects not found")
    
    comparison_data = []
    
    for project in projects:
        project_data = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "created_at": project.created_at,
            "estimates": {},
            "average_estimate": None
        }
        
        if project.estimates:
            estimates_list = []
            
            # Extract estimates from different methods
            if "cocomo" in project.estimates:
                effort = project.estimates["cocomo"].get("effort_person_months")
                if effort:
                    project_data["estimates"]["cocomo"] = effort
                    estimates_list.append(effort)
            
            if "function_points" in project.estimates:
                fp_avg = project.estimates["function_points"].get("estimates", {}).get("average_productivity", {}).get("person_months")
                if fp_avg:
                    project_data["estimates"]["function_points"] = fp_avg
                    estimates_list.append(fp_avg)
            
            if "expert_judgment" in project.estimates:
                ej_mean = project.estimates["expert_judgment"].get("mean")
                if ej_mean:
                    project_data["estimates"]["expert_judgment"] = ej_mean
                    estimates_list.append(ej_mean)
            
            if "delphi" in project.estimates:
                delphi_est = project.estimates["delphi"].get("final_estimate")
                if delphi_est:
                    project_data["estimates"]["delphi"] = delphi_est
                    estimates_list.append(delphi_est)
            
            if "regression" in project.estimates:
                reg_est = project.estimates["regression"].get("estimated_effort")
                if reg_est:
                    project_data["estimates"]["regression"] = reg_est
                    estimates_list.append(reg_est)
            
            # Calculate average estimate
            if estimates_list:
                project_data["average_estimate"] = sum(estimates_list) / len(estimates_list)
        
        comparison_data.append(project_data)
    
    # Calculate comparison statistics
    all_averages = [p["average_estimate"] for p in comparison_data if p["average_estimate"] is not None]
    
    comparison_summary = {
        "projects": comparison_data,
        "summary": {
            "total_projects": len(comparison_data),
            "projects_with_estimates": len(all_averages),
            "min_estimate": min(all_averages) if all_averages else None,
            "max_estimate": max(all_averages) if all_averages else None,
            "average_estimate": sum(all_averages) / len(all_averages) if all_averages else None
        }
    }
    
    return comparison_summary