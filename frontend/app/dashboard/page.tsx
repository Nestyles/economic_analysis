'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import CostEstimationModule from "@/components/CostEstimationModule"
import { getAuthToken, removeAuthToken } from "@/lib/auth"

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState("overview")
  useEffect(() => {
    // Check if user is authenticated
    const token = getAuthToken()
    if (!token) {
      router.push('/login')
      return
    }
    
    setUser('User') // Replace with actual user data from token
  }, [router])

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
    switch (activeSection) {
      case "overview":
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Dashboard Overview</h2>
              <p className="text-gray-600 mt-2">Welcome to your Economic Analysis Dashboard</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">💰</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Total Projects</h3>
                    <p className="text-3xl font-bold text-blue-600">12</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">📈</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Total Budget</h3>
                    <p className="text-3xl font-bold text-green-600">$485,200</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow border">
                <div className="flex items-center">
                  <div className="text-2xl mr-3">⚠️</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Active Risks</h3>
                    <p className="text-3xl font-bold text-red-600">3</p>
                  </div>
                </div>
              </div>            </div>
          </div>
        )
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