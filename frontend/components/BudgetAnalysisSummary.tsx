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

interface BudgetAnalysisSummaryProps {
  projectId: number;
  projectName: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function BudgetAnalysisSummary({ 
  projectId, 
  projectName, 
  isExpanded = false, 
  onToggleExpand 
}: BudgetAnalysisSummaryProps) {
  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        setError('No auth token found');
        return;
      }

      const response = await fetch(`http://localhost:8000/budget/${projectId}/analysis`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      } else if (response.status === 400) {
        setAnalysis(null);
        setError('No budget data available');
      } else {
        const errorData = await response.json().catch(() => null);
        setError(errorData?.detail || 'Failed to fetch budget analysis');
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
      setError('An error occurred while fetching budget analysis');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded) {
      fetchAnalysis();
    }
  }, [isExpanded, projectId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (!isExpanded) {
    return (
      <div className="mt-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onToggleExpand}
          className="w-full"
        >
          📊 View Budget Analysis
        </Button>
      </div>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Budget Analysis - {projectName}</CardTitle>
          <Button variant="outline" size="sm" onClick={onToggleExpand}>
            ✕ Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading budget analysis...</p>
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-red-600">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchAnalysis}
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            {/* Budget Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Budget</p>
                <p className="text-lg font-bold text-blue-600">
                  {formatCurrency(analysis.total_budget || 0)}
                </p>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Actual</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(analysis.total_actual || 0)}
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Variance</p>
                <p className={`text-lg font-bold ${(analysis.variance?.amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(analysis.variance?.amount || 0)} 
                  <span className="text-sm">
                    ({(analysis.variance?.percentage || 0).toFixed(1)}%)
                  </span>
                </p>
              </div>
            </div>

            {/* Financial Metrics */}
            {analysis.financial_metrics && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">💹 Financial Metrics</h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">ROI</p>
                    <p className={`text-sm font-bold ${analysis.financial_metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analysis.financial_metrics.roi.toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500">NPV</p>
                    <p className={`text-sm font-bold ${analysis.financial_metrics.npv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(analysis.financial_metrics.npv)}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500">IRR</p>
                    <p className={`text-sm font-bold ${(analysis.financial_metrics.irr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analysis.financial_metrics.irr ? `${analysis.financial_metrics.irr.toFixed(1)}%` : 'N/A'}
                    </p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Payback</p>
                    <p className="text-sm font-bold text-blue-600">
                      {analysis.financial_metrics.payback_period ? `${analysis.financial_metrics.payback_period.toFixed(1)}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Category Analysis */}
            {analysis.category_analysis && Object.keys(analysis.category_analysis).length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">📊 Category Breakdown</h4>
                <div className="space-y-1">
                  {Object.entries(analysis.category_analysis).slice(0, 3).map(([category, data]) => (
                    <div key={category} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                      <div>
                        <span className="font-medium text-gray-900">{category}</span>
                        <span className="text-xs text-gray-500 ml-2">{(data?.percentage || 0).toFixed(1)}%</span>
                      </div>
                      <span className="font-semibold text-indigo-600">
                        {formatCurrency(data?.total || 0)}
                      </span>
                    </div>
                  ))}
                  {Object.keys(analysis.category_analysis).length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{Object.keys(analysis.category_analysis).length - 3} more categories
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Forecast */}
            {analysis.forecast && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-2">🔮 3-Month Forecast</h4>
                <div className="grid grid-cols-3 gap-2">
                  {analysis.forecast.map((value, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded text-center">
                      <p className="text-xs text-gray-500">Month {index + 1}</p>
                      <p className="text-sm font-semibold text-indigo-600">
                        {formatCurrency(value || 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">📊</div>
            <p className="text-gray-600">No budget analysis data available.</p>
            <p className="text-sm text-gray-500">Track some budget items to see analysis.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
