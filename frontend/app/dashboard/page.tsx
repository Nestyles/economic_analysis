'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import CostEstimationModule from "@/components/CostEstimationModule"
import ProjectManagement from "@/components/ProjectManagement"
import ProjectEstimation from "@/components/ProjectEstimation"
import BudgetTrackingModule from "@/components/BudgetTrackingModule"
import RiskManagementModule from "@/components/RiskManagementModule"
import ResourceOptimizationModule from "@/components/ResourceOptimizationModule"
import DashboardBudgetOverview from "@/components/DashboardBudgetOverview"
import { getAuthToken, removeAuthToken } from "@/lib/auth"

interface DashboardStats {
  totalProjects: number;
  totalEstimatedCost: number;
  estimationsDone: number;
  averageProjectCost: number;
  recentProjects: Array<{
    id: number;
    name: string;
    description?: string;
    created_at: string;
    estimated_cost?: number;
    estimation_methods_count: number;
  }>;
}

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState("overview")
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalProjects: 0,
    totalEstimatedCost: 0,
    estimationsDone: 0,
    averageProjectCost: 0,    recentProjects: []
  })
  const [loadingStats, setLoadingStats] = useState(true)
  const [projectSelectionMode, setProjectSelectionMode] = useState<'budget' | 'financial' | 'risk' | 'resource' | null>(null)

  useEffect(() => {
    // Check if user is authenticated
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }
    
    setUser('User') // Replace with actual user data from token
    fetchDashboardStats()
  }, [router])

  const fetchDashboardStats = async () => {
    try {
      const token = getAuthToken()
      if (!token) {
        setLoadingStats(false)
        return
      }

      const response = await fetch('http://localhost:8000/projects/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const projects = await response.json()
        
        if (!Array.isArray(projects)) {
          console.error('Projects response is not an array:', projects)
          setLoadingStats(false)
          return
        }
        
        const totalProjects = projects.length
        let totalEstimatedCost = 0
        let estimationsDone = 0
        
        projects.forEach((project: any) => {
          if (project && typeof project === 'object') {
            if (project.estimates && typeof project.estimates === 'object') {
              const estimates = project.estimates
              const estimateValues = Object.values(estimates).filter((val: any) => 
                val && typeof val === 'object' && typeof val.effort_person_months === 'number'
              )
              
              if (estimateValues.length > 0) {
                const avgEstimate = estimateValues.reduce((sum: number, est: any) => 
                  sum + (est.effort_person_months || 0), 0
                ) / estimateValues.length
                
                totalEstimatedCost += avgEstimate
                estimationsDone += estimateValues.length
              }
            }
            
            if (project.estimated_cost && typeof project.estimated_cost === 'number') {
              if (!project.estimates || Object.keys(project.estimates).length === 0) {
                totalEstimatedCost += project.estimated_cost
                estimationsDone += project.estimation_methods_count || 1
              }
            }
          }
        })
        
        const averageProjectCost = totalProjects > 0 ? totalEstimatedCost / totalProjects : 0
        
        const recentProjects = projects
          .filter((project: any) => project && project.created_at)
          .sort((a: any, b: any) => {
            const dateA = new Date(a.created_at)
            const dateB = new Date(b.created_at)
            return dateB.getTime() - dateA.getTime()
          })
          .slice(0, 5)
          .map((project: any) => ({
            id: project.id || 0,
            name: project.name || 'Untitled Project',
            description: project.description || '',
            created_at: project.created_at,
            estimated_cost: project.estimated_cost || null,
            estimation_methods_count: project.estimation_methods_count || 0
          }))

        const finalStats = {
          totalProjects,
          totalEstimatedCost,
          estimationsDone,
          averageProjectCost,
          recentProjects
        }
        
        setDashboardStats(finalStats)
      } else {
        console.error('Failed to fetch dashboard stats:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const handleLogout = () => {
    removeAuthToken()
    router.push('/login')
  }
  const navigationItems = [
    {
      id: "overview",
      title: "Overview",
      icon: "📊"
    },
    {
      id: "projects",
      title: "Projects",
      icon: "📁"
    },
    {
      id: "cost-estimation",
      title: "Cost Estimation",
      icon: "💰"
    },
    {
      id: "budget-management",
      title: "Budget Management",
      icon: "📈"
    },    {
      id: "risk-management",
      title: "Risk Management",
      icon: "⚠️"
    },
    {
      id: "resource-optimization",
      title: "Resource Optimization",
      icon: "🔧"
    }
  ]

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )  }
  const handleProjectSelect = (projectId: number) => {
    setSelectedProjectId(projectId)
    if (projectSelectionMode === 'budget') {
      setActiveSection('budget-management')
      setProjectSelectionMode(null)
    } else if (projectSelectionMode === 'financial') {
      setActiveSection('risk-management')
      setProjectSelectionMode(null)
    } else if (projectSelectionMode === 'risk') {
      setActiveSection('risk-management')
      setProjectSelectionMode(null)
    } else if (projectSelectionMode === 'resource') {
      setActiveSection('resource-optimization')
      setProjectSelectionMode(null)
    }
  }

  const renderContent = () => {
    // Handle project estimation view
    if (selectedProjectId && activeSection === "projects" && !projectSelectionMode) {
      return (
        <ProjectEstimation 
          projectId={selectedProjectId} 
          onBack={() => setSelectedProjectId(null)}
        />
      )
    }

    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-8">            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">Dashboard Overview</h2>
                <p className="text-gray-600 mt-2">Welcome to your Economic Analysis Dashboard</p>
              </div>
              <Button 
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                onClick={() => {
                  setLoadingStats(true)
                  fetchDashboardStats()
                }}
                disabled={loadingStats}
              >
                {loadingStats ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg border border-blue-200 text-white transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center">
                  <div className="text-3xl mr-3 opacity-80">📁</div>
                  <div>
                    <h3 className="text-lg font-semibold text-blue-100">Total Projects</h3>
                    <p className="text-3xl font-bold">
                      {loadingStats ? '...' : dashboardStats.totalProjects}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-xl shadow-lg border border-emerald-200 text-white transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center">
                  <div className="text-3xl mr-3 opacity-80">💰</div>
                  <div>
                    <h3 className="text-lg font-semibold text-emerald-100">Total Estimated Cost</h3>
                    <p className="text-3xl font-bold">
                      {loadingStats ? '...' : `${dashboardStats.totalEstimatedCost.toFixed(0)} PM`}
                    </p>
                    <p className="text-xs text-emerald-200">Person-Months</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg border border-purple-200 text-white transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center">
                  <div className="text-3xl mr-3 opacity-80">📊</div>
                  <div>
                    <h3 className="text-lg font-semibold text-purple-100">Estimations Done</h3>
                    <p className="text-3xl font-bold">
                      {loadingStats ? '...' : dashboardStats.estimationsDone}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 rounded-xl shadow-lg border border-amber-200 text-white transform hover:scale-105 transition-all duration-300">
                <div className="flex items-center">
                  <div className="text-3xl mr-3 opacity-80">📈</div>
                  <div>
                    <h3 className="text-lg font-semibold text-amber-100">Average Cost</h3>
                    <p className="text-3xl font-bold">
                      {loadingStats ? '...' : `${dashboardStats.averageProjectCost.toFixed(1)} PM`}
                    </p>
                    <p className="text-xs text-amber-200">Per Project</p>
                  </div>
                </div>
              </div>
            </div>            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-blue-200/50">
              <div className="px-6 py-4 border-b border-blue-200/50 bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900">Recent Projects</h3>
                <p className="text-sm text-gray-600">Your latest project activities</p>
              </div>
              <div className="p-6">
                {loadingStats ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-600">Loading projects...</p>
                  </div>
                ) : dashboardStats.recentProjects.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="text-gray-600">No projects yet. Create your first project to get started!</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => setActiveSection("projects")}
                    >
                      Create Project
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardStats.recentProjects.map((project) => (                      <div key={project.id} className="flex items-center justify-between p-4 border border-blue-200/50 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{project.name}</h4>
                          {project.description && (
                            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                          )}
                          <div className="flex items-center mt-2 space-x-4 text-xs text-gray-500">
                            <span>Created: {new Date(project.created_at).toLocaleDateString()}</span>
                            {project.estimation_methods_count > 0 && (
                              <span>Estimations: {project.estimation_methods_count}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {project.estimated_cost ? (
                            <div className="text-right">
                              <p className="font-semibold text-emerald-600">{project.estimated_cost.toFixed(1)} PM</p>
                              <p className="text-xs text-gray-500">Estimated</p>
                            </div>
                          ) : (
                            <div className="text-right">
                              <p className="text-sm text-gray-400">No estimate</p>
                            </div>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 hover:from-blue-600 hover:to-purple-600"
                            onClick={() => setSelectedProjectId(project.id)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {dashboardStats.recentProjects.length >= 5 && (
                      <div className="text-center pt-4">
                        <Button 
                          variant="outline" 
                          onClick={() => setActiveSection("projects")}
                        >
                          View All Projects
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>            <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-purple-200/50">
              <div className="px-6 py-4 border-b border-purple-200/50 bg-gradient-to-r from-purple-50 to-pink-50 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-600">Common tasks and shortcuts</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button 
                    className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                    onClick={() => setActiveSection("projects")}
                  >
                    <span className="text-2xl">📁</span>
                    <span>Create New Project</span>
                  </Button>
                  
                  <Button 
                    className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                    onClick={() => setActiveSection("cost-estimation")}
                  >
                    <span className="text-2xl">💰</span>
                    <span>Cost Estimation</span>
                  </Button>
                  
                  <Button 
                    className="h-20 flex flex-col items-center justify-center space-y-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                    onClick={() => setActiveSection("risk-management")}
                  >
                    <span className="text-2xl">📋</span>
                    <span>Risk Analysis</span>
                  </Button>
                </div>
              </div>
            </div>            {!loadingStats && dashboardStats.totalProjects > 0 && (
              <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 rounded-xl border border-purple-200/50 p-6 shadow-lg">
                <h3 className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">📈 Project Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-indigo-200/50">
                    <p className="text-gray-700">
                      You have <span className="font-bold text-indigo-600">{dashboardStats.totalProjects}</span> projects 
                      with a total estimated effort of <span className="font-bold text-emerald-600">{dashboardStats.totalEstimatedCost.toFixed(1)} person-months</span>.
                    </p>
                  </div>
                  <div className="p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-purple-200/50">
                    <p className="text-gray-700">
                      Average project size is <span className="font-bold text-purple-600">{dashboardStats.averageProjectCost.toFixed(1)} person-months</span>, 
                      with <span className="font-bold text-pink-600">{dashboardStats.estimationsDone}</span> total estimations completed.
                    </p>
                  </div>
                </div>
              </div>            )}</div>
        );      case "projects":
        if (projectSelectionMode) {
          return (
            <div>
              <div className="mb-4 flex items-center justify-between">                <h2 className="text-2xl font-bold text-gray-900">
                  Select Project for {projectSelectionMode === 'budget' ? 'Budget Management' : projectSelectionMode === 'risk' ? 'Risk Analysis' : projectSelectionMode === 'resource' ? 'Resource Optimization' : 'Financial Metrics'}
                </h2>
                <Button 
                  variant="outline"                  onClick={() => {
                    setProjectSelectionMode(null);
                    setActiveSection(projectSelectionMode === 'budget' ? 'budget-management' : projectSelectionMode === 'resource' ? 'resource-optimization' : 'risk-management');
                  }}
                >
                  Back
                </Button>
              </div>
              <ProjectManagement 
                onProjectSelect={handleProjectSelect}
                selectMode={projectSelectionMode}
              />
            </div>
          );
        }
        return <ProjectManagement />;

      case "cost-estimation":
        return <CostEstimationModule />;      case "budget-management":
        if (selectedProjectId) {
          return (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Budget Management</h2>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedProjectId(null);
                  }}
                >
                  Switch Project
                </Button>
              </div>
              <BudgetTrackingModule projectId={selectedProjectId} />
            </div>
          );
        }        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-pulse">📈</div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent mb-2">Budget Management</h2>
            <p className="text-gray-600 mb-6">Track and manage project budgets with financial analysis</p>
            <Button 
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              onClick={() => {
                setProjectSelectionMode('budget');
                setActiveSection('projects');
              }}
            >
              Select a Project to Manage Budget
            </Button>
          </div>        );case "risk-management":
        if (selectedProjectId) {
          return (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Risk Management</h2>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedProjectId(null);
                  }}
                >
                  Switch Project
                </Button>
              </div>
              <RiskManagementModule projectId={selectedProjectId} />
            </div>
          );
        }        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-bounce">⚠️</div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-500 to-red-500 bg-clip-text text-transparent mb-2">Risk Management</h2>
            <p className="text-gray-600 mb-6">Perform risk analysis with sensitivity analysis, decision trees, and Monte Carlo simulations</p>
            <Button 
              className="bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              onClick={() => {
                setProjectSelectionMode('risk');
                setActiveSection('projects');
              }}
            >
              Select a Project for Risk Analysis
            </Button>
          </div>
        );

      case "resource-optimization":
        if (selectedProjectId) {
          return (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Resource Optimization</h2>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedProjectId(null);
                  }}
                >
                  Switch Project
                </Button>
              </div>
              <ResourceOptimizationModule projectId={selectedProjectId} />
            </div>
          );
        }        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4 animate-spin-slow">🔧</div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-cyan-500 bg-clip-text text-transparent mb-2">Resource Optimization</h2>
            <p className="text-gray-600 mb-6">Optimize resource allocation with leveling, smoothing, and scenario analysis</p>
            <Button 
              className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
              onClick={() => {
                setProjectSelectionMode('resource');
                setActiveSection('projects');
              }}
            >
              Select a Project for Resource Optimization
            </Button>
          </div>
        );

      default:
        return null
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-blue-900 dark:to-purple-900">
      <header className="bg-white/90 backdrop-blur-sm shadow-lg border-b border-blue-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-3 shadow-lg">
                  <span className="text-white font-bold text-sm">EA</span>
                </div>
                <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Economic Analysis</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user}</span>
              <Button variant="outline" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>      <nav className="bg-white/90 backdrop-blur-sm border-b border-blue-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);                  // Clear project selection when changing sections unless going to budget/risk/resource with a project
                  if (item.id !== 'budget-management' && item.id !== 'risk-management' && item.id !== 'resource-optimization') {
                    setSelectedProjectId(null);
                    setProjectSelectionMode(null);
                  }
                }}
                className={`flex items-center px-4 py-4 text-sm font-medium border-b-2 transition-all duration-300 whitespace-nowrap hover:transform hover:translateY(-1px) ${
                  activeSection === item.id
                    ? "border-purple-500 text-purple-600 bg-purple-50/50"
                    : "border-transparent text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50"
                }`}
              >
                <span className="mr-2 text-lg">{item.icon}</span>
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  )
}
