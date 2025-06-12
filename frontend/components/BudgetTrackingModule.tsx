import { useState, useEffect } from 'react';
import { getAuthToken } from '../lib/auth';

interface BudgetUpdate {
  actual_cost: number;
  period: string;
  category: string;
  description?: string;
}

interface FinancialInput {
  initial_investment: number;
  cash_flows: number[];
  discount_rate: number;
}

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

export default function BudgetTrackingModule({ projectId }: { projectId: number }) {
  const [budgetUpdate, setBudgetUpdate] = useState<BudgetUpdate>({
    actual_cost: 0,
    period: new Date().toISOString().slice(0, 7), // YYYY-MM format
    category: '',
    description: ''
  });
  const [financialInput, setFinancialInput] = useState<FinancialInput>({
    initial_investment: 0,
    cash_flows: [0, 0, 0, 0, 0], // 5 periods by default
    discount_rate: 10
  });
  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracking' | 'financial' | 'analysis'>('tracking');  const fetchAnalysis = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
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
        // No budget tracking data available yet - this is expected for new projects
        setAnalysis(null);
        console.log('No budget tracking data available yet for this project');
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to fetch budget analysis:', errorData?.detail || response.statusText);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
    }
  };

  const calculateFinancialMetrics = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:8000/budget/${projectId}/financials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(financialInput)
      });

      if (response.ok) {
        await fetchAnalysis(); // Refresh analysis to get updated metrics
        alert('Financial metrics calculated successfully!');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to calculate financial metrics. Please try again.');
      }
    } catch (error) {
      console.error('Error calculating financial metrics:', error);
      alert('An error occurred while calculating financial metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateBudget = async () => {
    if (!budgetUpdate.category || !budgetUpdate.period || budgetUpdate.actual_cost <= 0) {
      alert('Please fill in all required fields with valid values');
      return;
    }

    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:8000/budget/${projectId}/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(budgetUpdate)
      });

      if (response.ok) {
        await fetchAnalysis(); // Refresh analysis after update
        setBudgetUpdate({
          actual_cost: 0,
          period: new Date().toISOString().slice(0, 7),
          category: '',
          description: ''
        });
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to update budget. Please try again.');
      }
    } catch (error) {
      console.error('Error updating budget:', error);
      alert('An error occurred while updating the budget. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch analysis on component mount
  useEffect(() => {
    fetchAnalysis();
  }, [projectId]);

  const categories = [
    'Development',
    'Infrastructure',
    'Testing',
    'Project Management',
    'Training',
    'Other'
  ];
  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Budget & Financial Management</h2>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'tracking', label: 'Budget Tracking', icon: '📊' },
            { id: 'financial', label: 'Financial Metrics', icon: '💹' },
            { id: 'analysis', label: 'Analysis & Reports', icon: '📈' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Budget Tracking Tab */}
      {activeTab === 'tracking' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Budget Tracking</h3>
          
          {/* Budget Update Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Actual Cost ($)
              </label>
              <input
                type="number"
                value={budgetUpdate.actual_cost}
                onChange={e => setBudgetUpdate(prev => ({ ...prev, actual_cost: parseFloat(e.target.value) || 0 }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter actual cost"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Period
              </label>
              <input
                type="month"
                value={budgetUpdate.period}
                onChange={e => setBudgetUpdate(prev => ({ ...prev, period: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={budgetUpdate.category}
                onChange={e => setBudgetUpdate(prev => ({ ...prev, category: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Select a category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={budgetUpdate.description}
                onChange={e => setBudgetUpdate(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Optional description"
              />
            </div>
          </div>

          <button
            onClick={updateBudget}
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Budget'}
          </button>
        </div>
      )}

      {/* Financial Metrics Tab */}
      {activeTab === 'financial' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Financial Metrics Calculator</h3>
          <p className="text-sm text-gray-600">Calculate ROI, NPV, IRR, and Payback Period for your project</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Investment ($)
              </label>
              <input
                type="number"
                value={financialInput.initial_investment}
                onChange={e => setFinancialInput(prev => ({ ...prev, initial_investment: parseFloat(e.target.value) || 0 }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter initial investment amount"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Discount Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={financialInput.discount_rate}
                onChange={e => setFinancialInput(prev => ({ ...prev, discount_rate: parseFloat(e.target.value) || 0 }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Enter discount rate (e.g., 10 for 10%)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Expected Cash Flows ($)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2">
                {financialInput.cash_flows.map((flow, index) => (
                  <div key={index}>
                    <label className="block text-xs text-gray-500 mb-1">Period {index + 1}</label>
                    <input
                      type="number"
                      value={flow}
                      onChange={e => {
                        const newFlows = [...financialInput.cash_flows];
                        newFlows[index] = parseFloat(e.target.value) || 0;
                        setFinancialInput(prev => ({ ...prev, cash_flows: newFlows }));
                      }}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={() => setFinancialInput(prev => ({ ...prev, cash_flows: [...prev.cash_flows, 0] }))}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  + Add Period
                </button>
                {financialInput.cash_flows.length > 1 && (
                  <button
                    onClick={() => setFinancialInput(prev => ({ ...prev, cash_flows: prev.cash_flows.slice(0, -1) }))}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    - Remove Period
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={calculateFinancialMetrics}
              disabled={loading || financialInput.initial_investment <= 0}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Calculating...' : 'Calculate Financial Metrics'}
            </button>
          </div>
        </div>
      )}

      {/* Analysis & Reports Tab */}
      {activeTab === 'analysis' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Analysis & Reports</h3>
            <button
              onClick={fetchAnalysis}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Refresh Data
            </button>
          </div>

          {analysis ? (
            <div className="space-y-6">
              {/* Budget Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Total Budget</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    ${(analysis.total_budget || 0).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Total Actual</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    ${(analysis.total_actual || 0).toFixed(2)}
                  </p>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Variance</p>
                  <p className={`text-2xl font-bold ${(analysis.variance?.amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(analysis.variance?.amount || 0).toFixed(2)} ({(analysis.variance?.percentage || 0).toFixed(1)}%)
                  </p>
                </div>
              </div>

              {/* Financial Metrics */}
              {analysis.financial_metrics && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">💹 Financial Performance Metrics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Return on Investment</p>
                      <p className={`text-2xl font-bold ${analysis.financial_metrics.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {analysis.financial_metrics.roi.toFixed(2)}%
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Net Present Value</p>
                      <p className={`text-2xl font-bold ${analysis.financial_metrics.npv >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${analysis.financial_metrics.npv.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Internal Rate of Return</p>
                      <p className={`text-2xl font-bold ${(analysis.financial_metrics.irr || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {analysis.financial_metrics.irr ? `${analysis.financial_metrics.irr.toFixed(2)}%` : 'N/A'}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Payback Period</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {analysis.financial_metrics.payback_period ? `${analysis.financial_metrics.payback_period.toFixed(1)} periods` : 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {analysis.financial_metrics.details && (
                    <div className="mt-4 text-sm text-gray-600">
                      <p><strong>Investment:</strong> ${analysis.financial_metrics.details.total_investment.toFixed(2)}</p>
                      <p><strong>Total Returns:</strong> ${analysis.financial_metrics.details.total_returns.toFixed(2)}</p>
                      <p><strong>Discount Rate:</strong> {analysis.financial_metrics.details.discount_rate}%</p>
                    </div>
                  )}
                </div>
              )}

              {/* Category Analysis */}
              {analysis.category_analysis && Object.keys(analysis.category_analysis).length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">📊 Category Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(analysis.category_analysis).map(([category, data]) => (
                      <div key={category} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                        <div>
                          <p className="font-medium text-gray-900">{category}</p>
                          <p className="text-sm text-gray-500">{(data?.percentage || 0).toFixed(1)}% of total</p>
                        </div>
                        <p className="text-lg font-semibold text-indigo-600">
                          ${(data?.total || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forecast */}
              {analysis.forecast && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">🔮 3-Month Forecast</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analysis.forecast.map((value, index) => (
                      <div key={index} className="p-3 bg-gray-50 rounded-md">
                        <p className="text-sm text-gray-500">Month {index + 1}</p>
                        <p className="text-lg font-semibold text-indigo-600">
                          ${(value || 0).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">📊</div>
              <p className="text-gray-600">No analysis data available. Start by tracking some budget items.</p>
              <button
                onClick={() => setActiveTab('tracking')}
                className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                Go to Budget Tracking
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
