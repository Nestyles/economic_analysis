'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAuthToken } from "@/lib/auth"
import BudgetAnalysisSummary from "./BudgetAnalysisSummary"
import BudgetComparison from "./BudgetComparison"

interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  estimated_cost?: number;
  estimation_methods_count: number;
}

interface NewProject {
  name: string;
  description: string;
}

interface ProjectManagementProps {
  onProjectSelect?: (projectId: number, action?: 'budget' | 'financial' | 'estimate' | 'risk' | 'resource') => void;
  selectMode?: 'budget' | 'financial' | 'risk' | 'resource' | 'normal';
}

export default function ProjectManagement({ onProjectSelect, selectMode = 'normal' }: ProjectManagementProps = {}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProject, setNewProject] = useState<NewProject>({ name: '', description: '' })
  const [creating, setCreating] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<number[]>([])
  const [comparing, setComparing] = useState(false)
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [expandedBudgetAnalysis, setExpandedBudgetAnalysis] = useState<number | null>(null)
  const [showBudgetComparison, setShowBudgetComparison] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      const token = getAuthToken()
      const response = await fetch('http://localhost:8000/projects/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      } else {
        console.error('Failed to fetch projects')
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const createProject = async () => {
    if (!newProject.name.trim()) return

    setCreating(true)
    try {
      const token = getAuthToken()
      const response = await fetch('http://localhost:8000/projects/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newProject)
      })
      
      if (response.ok) {
        setNewProject({ name: '', description: '' })
        setShowCreateForm(false)
        fetchProjects() // Refresh the list
      } else {
        console.error('Failed to create project')
      }
    } catch (error) {
      console.error('Error creating project:', error)
    } finally {
      setCreating(false)
    }
  }

  const deleteProject = async (projectId: number) => {
    if (!confirm('Are you sure you want to delete this project?')) return

    try {
      const token = getAuthToken()
      const response = await fetch(`http://localhost:8000/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        fetchProjects() // Refresh the list
      } else {
        console.error('Failed to delete project')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const toggleProjectSelection = (projectId: number) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }
  const compareProjects = async () => {
    if (selectedProjects.length < 2) {
      alert('Please select at least 2 projects to compare')
      return
    }

    setComparing(true)
    try {
      const token = getAuthToken()
      const queryParams = selectedProjects.map(id => `project_ids=${id}`).join('&')
      const response = await fetch(`http://localhost:8000/projects/compare/?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setComparisonData(data)
      } else {
        console.error('Failed to compare projects')
      }
    } catch (error) {
      console.error('Error comparing projects:', error)
    } finally {
      setComparing(false)
    }
  }

  const compareBudgets = () => {
    if (selectedProjects.length < 2) {
      alert('Please select at least 2 projects to compare budget analysis')
      return
    }
    setShowBudgetComparison(true)
  }

  const getProjectNamesMap = () => {
    const map: { [key: number]: string } = {}
    projects.forEach(project => {
      map[project.id] = project.name
    })
    return map
  }

  const formatCurrency = (amount?: number) => {
    if (amount === null || amount === undefined) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount * 10000) // Assuming person-months * $10k average rate
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading projects...</span>
      </div>
    )
  }
  return (
    <div className="space-y-6">      <div className="flex justify-between items-center">
        <div>          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-teal-600 bg-clip-text text-transparent">
            {selectMode === 'budget' 
              ? 'Select Project for Budget Management' 
              : selectMode === 'financial' 
              ? 'Select Project for Financial Metrics'
              : selectMode === 'risk'
              ? 'Select Project for Risk Analysis'
              : selectMode === 'resource'
              ? 'Select Project for Resource Optimization'
              : 'Project Management'
            }
          </h2>
          <p className="text-gray-600 mt-2 text-lg">
            {selectMode === 'budget' 
              ? 'Choose a project to manage its budget and track financial performance'
              : selectMode === 'financial'
              ? 'Choose a project to analyze its financial metrics (ROI, NPV, IRR, Payback)'
              : selectMode === 'risk'
              ? 'Choose a project to perform risk analysis with sensitivity analysis, decision trees, and Monte Carlo simulations'
              : selectMode === 'resource'
              ? 'Choose a project to optimize resource allocation with leveling, smoothing, and scenario analysis'
              : 'Create, manage, and compare your economic analysis projects'
            }
          </p>
        </div>        <div className="space-x-2">
          {selectMode === 'normal' && selectedProjects.length >= 2 && (
            <>
              <Button 
                onClick={compareProjects} 
                disabled={comparing}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                {comparing ? 'Comparing...' : `Compare ${selectedProjects.length} Projects`}
              </Button>
              <Button 
                onClick={compareBudgets} 
                disabled={comparing}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              >
                📊 Compare Budgets
              </Button>
            </>
          )}
          {selectMode === 'normal' && (
            <Button 
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              ✨ New Project
            </Button>
          )}
        </div>
      </div>      {/* Create Project Form */}
      {selectMode === 'normal' && showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Add a new project to start cost estimation analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="projectName">Project Name</Label>
              <Input
                id="projectName"
                placeholder="Enter project name"
                value={newProject.name}
                onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="projectDescription">Description</Label>
              <textarea
                id="projectDescription"
                className="w-full p-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Enter project description (optional)"
                value={newProject.description}
                onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={createProject} disabled={creating || !newProject.name.trim()}>
                {creating ? 'Creating...' : 'Create Project'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Comparison */}
      {showBudgetComparison && (
        <BudgetComparison
          projectIds={selectedProjects}
          projectNames={getProjectNamesMap()}
          onClose={() => setShowBudgetComparison(false)}
        />
      )}

      {/* Comparison Results */}
      {comparisonData && (
        <Card>
          <CardHeader>
            <CardTitle>Project Comparison Results</CardTitle>
            <div className="flex justify-between items-center">
              <CardDescription>
                Comparing {comparisonData.summary.total_projects} projects
              </CardDescription>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setComparisonData(null)}
              >
                Close Comparison
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-blue-50 rounded">
                <h4 className="font-semibold text-blue-900">Average Estimate</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(comparisonData.summary.average_estimate)}
                </p>
              </div>
              <div className="p-4 bg-green-50 rounded">
                <h4 className="font-semibold text-green-900">Lowest Estimate</h4>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(comparisonData.summary.min_estimate)}
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded">
                <h4 className="font-semibold text-red-900">Highest Estimate</h4>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(comparisonData.summary.max_estimate)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">Project Details</h4>
              {comparisonData.projects.map((project: any) => (
                <div key={project.id} className="border rounded p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium">{project.name}</h5>
                      <p className="text-sm text-gray-600">{project.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCurrency(project.average_estimate)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {Object.keys(project.estimates).length} estimation method(s)
                      </p>
                    </div>
                  </div>
                  
                  {Object.keys(project.estimates).length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      {Object.entries(project.estimates).map(([method, value]: [string, any]) => (
                        <div key={method} className="p-2 bg-gray-50 rounded">
                          <div className="font-medium capitalize">{method.replace('_', ' ')}</div>
                          <div className="text-gray-600">{value?.toFixed(1)} PM</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Projects List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-6xl mb-4">📂</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Projects Yet</h3>
            <p className="text-gray-600 mb-4">Create your first project to start cost estimation analysis</p>
            <Button onClick={() => setShowCreateForm(true)}>
              Create Your First Project
            </Button>
          </div>
        ) : (
          projects.map((project) => (
            <Card key={project.id} className={`cursor-pointer transition-all ${
              selectedProjects.includes(project.id) ? 'ring-2 ring-blue-500' : ''
            }`}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {project.description || 'No description provided'}
                    </CardDescription>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedProjects.includes(project.id)}
                    onChange={() => toggleProjectSelection(project.id)}
                    className="ml-2"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Estimated Cost:</span>
                    <span className="font-medium">
                      {formatCurrency(project.estimated_cost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Estimation Methods:</span>
                    <span className="font-medium">{project.estimation_methods_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Created:</span>
                    <span className="text-sm">{formatDate(project.created_at)}</span>
                  </div>                </div>

                {/* Budget Analysis Summary for normal mode */}
                {selectMode === 'normal' && (
                  <BudgetAnalysisSummary
                    projectId={project.id}
                    projectName={project.name}
                    isExpanded={expandedBudgetAnalysis === project.id}
                    onToggleExpand={() => 
                      setExpandedBudgetAnalysis(
                        expandedBudgetAnalysis === project.id ? null : project.id
                      )
                    }
                  />
                )}

                <div className="flex justify-between mt-4 pt-4 border-t">                  {selectMode === 'budget' ? (
                    <Button 
                      size="sm" 
                      className="flex-1 mr-2"
                      onClick={() => onProjectSelect?.(project.id, 'budget')}
                    >
                      Select for Budget Management
                    </Button>
                  ) : selectMode === 'financial' ? (
                    <Button 
                      size="sm" 
                      className="flex-1 mr-2"
                      onClick={() => onProjectSelect?.(project.id, 'financial')}
                    >
                      Select for Financial Metrics
                    </Button>
                  ) : selectMode === 'risk' ? (
                    <Button 
                      size="sm" 
                      className="flex-1 mr-2"
                      onClick={() => onProjectSelect?.(project.id, 'risk')}
                    >
                      Select for Risk Analysis
                    </Button>
                  ) : selectMode === 'resource' ? (
                    <Button 
                      size="sm" 
                      className="flex-1 mr-2"
                      onClick={() => onProjectSelect?.(project.id, 'resource')}
                    >
                      Select for Resource Optimization
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {/* Navigate to estimate page */}}
                    >
                      Add Estimates
                    </Button>
                  )}
                  {selectMode === 'normal' && (
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => deleteProject(project.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
