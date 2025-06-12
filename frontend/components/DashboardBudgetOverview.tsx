import { useState, useEffect } from 'react';
import { getAuthToken } from '../lib/auth';
import { Button } from "@/components/ui/button";

interface BudgetSummary {
  projectId: number;
  projectName: string;
  totalBudget: number;
  totalActual: number;
  variance: {
    amount: number;
    percentage: number;
  };
  roi?: number;
  hasData: boolean;
}

interface DashboardBudgetOverviewProps {
  recentProjects: Array<{
    id: number;
    name: string;
    description?: string;
    created_at: string;
    estimated_cost?: number;
    estimation_methods_count: number;
  }>;
}

export default function DashboardBudgetOverview({ recentProjects }: DashboardBudgetOverviewProps) {
  const [budgetSummaries, setBudgetSummaries] = useState<BudgetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (recentProjects.length > 0) {
      fetchBudgetSummaries();
    }
  }, [recentProjects]);

  const fetchBudgetSummaries = async () => {
    setLoading(true);
    const summaries: BudgetSummary[] = [];

    for (const project of recentProjects.slice(0, 3)) { // Only get top 3 for overview
      try {
        const token = getAuthToken();
        if (!token) continue;

        const response = await fetch(`http://localhost:8000/budget/${project.id}/analysis`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          summaries.push({
            projectId: project.id,
            projectName: project.name,
            totalBudget: data.total_budget || 0,
            totalActual: data.total_actual || 0,
            variance: data.variance || { amount: 0, percentage: 0 },
            roi: data.financial_metrics?.roi,
            hasData: true
          });
        } else {
          summaries.push({
            projectId: project.id,
            projectName: project.name,
            totalBudget: 0,
            totalActual: 0,
            variance: { amount: 0, percentage: 0 },
            hasData: false
          });
        }
      } catch (error) {
        console.error(`Error fetching budget for project ${project.id}:`, error);
        summaries.push({
          projectId: project.id,
          projectName: project.name,
          totalBudget: 0,
          totalActual: 0,
          variance: { amount: 0, percentage: 0 },
          hasData: false
        });
      }
    }

    setBudgetSummaries(summaries);
    setLoading(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (recentProjects.length === 0) {
    return null;
  }

  const projectsWithBudgetData = budgetSummaries.filter(s => s.hasData);
  const avgROI = projectsWithBudgetData.length > 0 
    ? projectsWithBudgetData
        .filter(s => s.roi !== undefined)
        .reduce((sum, s) => sum + (s.roi || 0), 0) / projectsWithBudgetData.filter(s => s.roi !== undefined).length
    : null;

  return (
    <div className="bg-white rounded-lg shadow border">
      <div className="px-6 py-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Budget Performance Overview</h3>
        <p className="text-sm text-gray-600">Recent projects budget tracking and financial metrics</p>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading budget data...</p>
          </div>
        ) : projectsWithBudgetData.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-gray-600">No budget data available yet.</p>
            <p className="text-sm text-gray-500">Start tracking budgets in your projects to see performance metrics here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Stats */}
            {avgROI !== null && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-blue-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Projects with Budget Data</p>
                  <p className="text-2xl font-bold text-blue-600">{projectsWithBudgetData.length}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Average ROI</p>
                  <p className={`text-2xl font-bold ${avgROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {avgROI.toFixed(1)}%
                  </p>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Total Budget Tracked</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {formatCurrency(projectsWithBudgetData.reduce((sum, s) => sum + s.totalBudget, 0))}
                  </p>
                </div>
              </div>
            )}

            {/* Individual Project Summaries */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Project Budget Status</h4>
              {budgetSummaries.map((summary) => (
                <div key={summary.projectId} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900">{summary.projectName}</h5>
                    {summary.hasData ? (
                      <div className="flex items-center space-x-4 mt-1 text-sm">
                        <span className="text-gray-600">
                          Budget: {formatCurrency(summary.totalBudget)}
                        </span>
                        <span className="text-gray-600">
                          Actual: {formatCurrency(summary.totalActual)}
                        </span>
                        <span className={`font-medium ${summary.variance.percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {summary.variance.percentage.toFixed(1)}% variance
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 mt-1">No budget data available</p>
                    )}
                  </div>
                  <div className="text-right">
                    {summary.hasData && summary.roi !== undefined ? (
                      <div>
                        <p className="text-sm text-gray-500">ROI</p>
                        <p className={`font-bold ${summary.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {summary.roi.toFixed(1)}%
                        </p>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {budgetSummaries.length < recentProjects.length && (
              <div className="text-center pt-4">
                <p className="text-sm text-gray-500">
                  Showing {budgetSummaries.length} of {recentProjects.length} recent projects
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
