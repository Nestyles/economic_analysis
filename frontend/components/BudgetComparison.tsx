import { useState, useEffect } from 'react';
import { getAuthToken } from '../lib/auth';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface FinancialMetrics {
  roi: number;
  npv: number;
  irr: number | null;
  payback_period: number | null;
  details: {
    total_investment: number;
    total_returns: number;
    discount_rate: number;
  };
}

interface BudgetAnalysis {
  total_budget: number;
  total_actual: number;
  variance: {
    amount: number;
    percentage: number;
  };
  category_analysis: {
    [key: string]: {
      total: number;
      percentage: number;
      periods: {
        [key: string]: number;
      };
    };
  };
  periods: string[];
  forecast: number[] | null;
  financial_metrics: FinancialMetrics | null;
}

interface ProjectBudgetComparison {
  id: number;
  name: string;
  analysis: BudgetAnalysis | null;
  error?: string;
}

interface BudgetComparisonProps {
  projectIds: number[];
  projectNames: { [key: number]: string };
  onClose: () => void;
}

export default function BudgetComparison({ projectIds, projectNames, onClose }: BudgetComparisonProps) {
  const [comparisons, setComparisons] = useState<ProjectBudgetComparison[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBudgetComparisons();
  }, [projectIds]);

  const fetchBudgetComparisons = async () => {
    setLoading(true);
    const results: ProjectBudgetComparison[] = [];

    for (const projectId of projectIds) {
      try {
        const token = getAuthToken();
        if (!token) {
          results.push({
            id: projectId,
            name: projectNames[projectId] || `Project ${projectId}`,
            analysis: null,
            error: 'No auth token found'
          });
          continue;
        }

        const response = await fetch(`http://localhost:8000/budget/${projectId}/analysis`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          results.push({
            id: projectId,
            name: projectNames[projectId] || `Project ${projectId}`,
            analysis: data
          });
        } else if (response.status === 400) {
          results.push({
            id: projectId,
            name: projectNames[projectId] || `Project ${projectId}`,
            analysis: null,
            error: 'No budget data available'
          });
        } else {
          const errorData = await response.json().catch(() => null);
          results.push({
            id: projectId,
            name: projectNames[projectId] || `Project ${projectId}`,
            analysis: null,
            error: errorData?.detail || 'Failed to fetch budget analysis'
          });
        }
      } catch (error) {
        console.error(`Error fetching analysis for project ${projectId}:`, error);
        results.push({
          id: projectId,
          name: projectNames[projectId] || `Project ${projectId}`,
          analysis: null,
          error: 'An error occurred while fetching budget analysis'
        });
      }
    }

    setComparisons(results);
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

  const getComparisonSummary = () => {
    const validAnalyses = comparisons.filter(c => c.analysis !== null);
    if (validAnalyses.length === 0) return null;

    const totalBudgets = validAnalyses.map(c => c.analysis!.total_budget || 0);
    const totalActuals = validAnalyses.map(c => c.analysis!.total_actual || 0);
    const rois = validAnalyses
      .filter(c => c.analysis!.financial_metrics?.roi !== undefined)
      .map(c => c.analysis!.financial_metrics!.roi);

    return {
      avgBudget: totalBudgets.reduce((a, b) => a + b, 0) / totalBudgets.length,
      avgActual: totalActuals.reduce((a, b) => a + b, 0) / totalActuals.length,
      maxBudget: Math.max(...totalBudgets),
      minBudget: Math.min(...totalBudgets),
      avgROI: rois.length > 0 ? rois.reduce((a, b) => a + b, 0) / rois.length : null,
      bestPerformer: validAnalyses.reduce((best, current) => {
        const currentROI = current.analysis?.financial_metrics?.roi || -Infinity;
        const bestROI = best.analysis?.financial_metrics?.roi || -Infinity;
        return currentROI > bestROI ? current : best;
      }),
      worstPerformer: validAnalyses.reduce((worst, current) => {
        const currentROI = current.analysis?.financial_metrics?.roi || Infinity;
        const worstROI = worst.analysis?.financial_metrics?.roi || Infinity;
        return currentROI < worstROI ? current : worst;
      })
    };
  };

  const summary = getComparisonSummary();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Budget Analysis Comparison</CardTitle>
            <CardDescription>
              Comparing {projectIds.length} projects' budget performance and financial metrics
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            ✕ Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading budget comparisons...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Statistics */}
            {summary && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-4">📊 Comparison Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Average Budget</p>
                    <p className="text-lg font-bold text-blue-600">
                      {formatCurrency(summary.avgBudget)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Average Actual</p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(summary.avgActual)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Budget Range</p>
                    <p className="text-lg font-bold text-gray-600">
                      {formatCurrency(summary.minBudget)} - {formatCurrency(summary.maxBudget)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Average ROI</p>
                    <p className={`text-lg font-bold ${(summary.avgROI || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {summary.avgROI !== null ? `${summary.avgROI.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                </div>

                {summary.avgROI !== null && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-green-100 rounded">
                      <p className="font-medium text-green-800">🏆 Best Performer</p>
                      <p className="text-green-700">
                        {summary.bestPerformer.name} 
                        <span className="font-semibold ml-1">
                          ({summary.bestPerformer.analysis?.financial_metrics?.roi.toFixed(1)}% ROI)
                        </span>
                      </p>
                    </div>
                    <div className="p-3 bg-red-100 rounded">
                      <p className="font-medium text-red-800">📉 Needs Attention</p>
                      <p className="text-red-700">
                        {summary.worstPerformer.name}
                        <span className="font-semibold ml-1">
                          ({summary.worstPerformer.analysis?.financial_metrics?.roi.toFixed(1)}% ROI)
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Individual Project Comparisons */}
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900">Project Details</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {comparisons.map((project) => (
                  <Card key={project.id} className="border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {project.error ? (
                        <div className="text-center py-4">
                          <div className="text-2xl mb-2">⚠️</div>
                          <p className="text-red-600 text-sm">{project.error}</p>
                        </div>
                      ) : project.analysis ? (
                        <div className="space-y-3">
                          {/* Budget Overview */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="text-center p-2 bg-blue-50 rounded">
                              <p className="text-xs text-gray-500">Budget</p>
                              <p className="text-sm font-bold text-blue-600">
                                {formatCurrency(project.analysis.total_budget || 0)}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-green-50 rounded">
                              <p className="text-xs text-gray-500">Actual</p>
                              <p className="text-sm font-bold text-green-600">
                                {formatCurrency(project.analysis.total_actual || 0)}
                              </p>
                            </div>
                            <div className="text-center p-2 bg-gray-50 rounded">
                              <p className="text-xs text-gray-500">Variance</p>
                              <p className={`text-sm font-bold ${(project.analysis.variance?.percentage || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(project.analysis.variance?.percentage || 0).toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          {/* Financial Metrics */}
                          {project.analysis.financial_metrics && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-center p-2 bg-purple-50 rounded">
                                <p className="text-xs text-gray-500">ROI</p>
                                <p className={`text-sm font-bold ${project.analysis.financial_metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {project.analysis.financial_metrics.roi.toFixed(1)}%
                                </p>
                              </div>
                              <div className="text-center p-2 bg-orange-50 rounded">
                                <p className="text-xs text-gray-500">NPV</p>
                                <p className={`text-sm font-bold ${project.analysis.financial_metrics.npv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(project.analysis.financial_metrics.npv)}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Top Categories */}
                          {project.analysis.category_analysis && Object.keys(project.analysis.category_analysis).length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700 mb-1">Top Categories</p>
                              <div className="space-y-1">
                                {Object.entries(project.analysis.category_analysis)
                                  .slice(0, 2)
                                  .map(([category, data]) => (
                                    <div key={category} className="flex justify-between text-xs">
                                      <span className="text-gray-600">{category}</span>
                                      <span className="font-medium">{formatCurrency(data?.total || 0)}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-2xl mb-2">📊</div>
                          <p className="text-gray-600 text-sm">No budget data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
