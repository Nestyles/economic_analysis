'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import CostEstimationModule from "@/components/CostEstimationModule"
import ProjectManagement from "@/components/ProjectManagement"
import ProjectEstimation from "@/components/ProjectEstimation"
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
    averageProjectCost: 0,
    recentProjects: []
  })
  const [loadingStats, setLoadingStats] = useState(true)

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
        console.log('Fetched projects:', projects)
        
        // Ensure projects is an array
        if (!Array.isArray(projects)) {
          console.error('Projects response is not an array:', projects)
          setLoadingStats(false)
          return
        }
        
        // Calculate statistics safely
        const totalProjects = projects.length
        let totalEstimatedCost = 0
        let estimationsDone = 0
        
        projects.forEach((project: any) => {
          // Safe access to project properties
          if (project && typeof project === 'object') {
            // Count any project with estimates as having estimated cost
            if (project.estimates && typeof project.estimates === 'object') {
              const estimates = project.estimates
              const estimateValues = Object.values(estimates).filter((val: any) => 
                val && typeof val === 'object' && typeof val.effort_person_months === 'number'
              )
              
              if (estimateValues.length > 0) {
                // Calculate average of available estimates
                const avgEstimate = estimateValues.reduce((sum: number, est: any) => 
                  sum + (est.effort_person_months || 0), 0
                ) / estimateValues.length
                
                totalEstimatedCost += avgEstimate
                estimationsDone += estimateValues.length
              }
            }
            
            // Fallback to estimated_cost if available
            if (project.estimated_cost && typeof project.estimated_cost === 'number') {
              if (!project.estimates || Object.keys(project.estimates).length === 0) {
                totalEstimatedCost += project.estimated_cost
                estimationsDone += project.estimation_methods_count || 1
              }
            }
          }
        })
        
        const averageProjectCost = totalProjects > 0 ? totalEstimatedCost / totalProjects : 0
        
        // Get recent projects (last 5) with safe date parsing
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
        
        console.log('Dashboard stats calculated:', finalStats)
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
    },
    {
      id: "risk-management",
      title: "Risk Management",
      icon: "⚠️"
    },
    {
      id: "reports",
      title: "Reports",
      icon: "📋"
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
    )
  }
  const renderContent = () => {
    // Handle project estimation view
    if (selectedProjectId) {
      return (
        <ProjectEstimation 
          projectId={selectedProjectId} 
          onBack={() => setSelectedProjectId(null)}
        />
      )
    }

    switch (activeSection) {      case "overview":
        return (
          <div className="space-y-8">            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
                <p className="text-gray-600 mt-2">Welcome to your Economic Analysis Dashboard</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => {
                  setLoadingStats(true)
                  fetchDashboardStats()
                }}
                disabled={loadingStats}
              >
                {loadingStats ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
            
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">📁</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Total Projects</h3>
                    <p className="text-3xl font-bold text-blue-600">
                      {loadingStats ? '...' : dashboardStats.totalProjects}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">💰</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Total Estimated Cost</h3>
                    <p className="text-3xl font-bold text-green-600">
                      {loadingStats ? '...' : `${dashboardStats.totalEstimatedCost.toFixed(0)} PM`}
                    </p>
                    <p className="text-xs text-gray-500">Person-Months</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">📊</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Estimations Done</h3>
                    <p className="text-3xl font-bold text-purple-600">
                      {loadingStats ? '...' : dashboardStats.estimationsDone}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">📈</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Average Cost</h3>
                    <p className="text-3xl font-bold text-orange-600">
                      {loadingStats ? '...' : `${dashboardStats.averageProjectCost.toFixed(1)} PM`}
                    </p>
                    <p className="text-xs text-gray-500">Per Project</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Projects */}
            <div className="bg-white rounded-lg shadow border">
              <div className="px-6 py-4 border-b">
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
                    {dashboardStats.recentProjects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
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
                              <p className="font-semibold text-green-600">{project.estimated_cost.toFixed(1)} PM</p>
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
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow border">
              <div className="px-6 py-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
                <p className="text-sm text-gray-600">Common tasks and shortcuts</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button 
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveSection("projects")}
                  >
                    <span className="text-2xl">📁</span>
                    <span>Create New Project</span>
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveSection("cost-estimation")}
                  >
                    <span className="text-2xl">💰</span>
                    <span>Cost Estimation</span>
                  </Button>
                  
                  <Button 
                    variant="outline"
                    className="h-20 flex flex-col items-center justify-center space-y-2"
                    onClick={() => setActiveSection("reports")}
                  >
                    <span className="text-2xl">📋</span>
                    <span>View Reports</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Summary Insights */}
            {!loadingStats && dashboardStats.totalProjects > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Project Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">
                      You have <span className="font-semibold text-blue-600">{dashboardStats.totalProjects}</span> projects 
                      with a total estimated effort of <span className="font-semibold text-green-600">{dashboardStats.totalEstimatedCost.toFixed(1)} person-months</span>.
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">
                      Average project size is <span className="font-semibold text-orange-600">{dashboardStats.averageProjectCost.toFixed(1)} person-months</span>, 
                      with <span className="font-semibold text-purple-600">{dashboardStats.estimationsDone}</span> total estimations completed.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      case "projects":
        return <ProjectManagement />
      case "cost-estimation":
        return <CostEstimationModule />;
      case "budget-management":
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📈</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Budget Management</h2>
            <p className="text-gray-600">Manage and track project budgets</p>
          </div>
        )
      case "risk-management":
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Risk Management</h2>
            <p className="text-gray-600">Identify and mitigate project risks</p>
          </div>
        )
      case "reports":
        return (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Reports</h2>
            <p className="text-gray-600">Generate and view analysis reports</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">EA</span>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Economic Analysis</h1>
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
      </header>

      {/* Navigation Bar */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center px-3 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeSection === item.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.title}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {renderContent()}
      </main>
    </div>
  )
}