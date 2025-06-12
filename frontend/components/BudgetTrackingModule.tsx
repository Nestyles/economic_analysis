import { useState, useEffect } from 'react';
import { getAuthToken } from '../lib/auth';

interface BudgetUpdate {
  actual_cost: number;
  period: string;
  category: string;
  description?: string;
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
  financial_metrics: {
    roi: number;
    npv: number;
    irr: number | null;
    payback_period: number | null;
  } | null;
}

export default function BudgetTrackingModule({ projectId }: { projectId: number }) {
  const [budgetUpdate, setBudgetUpdate] = useState<BudgetUpdate>({
    actual_cost: 0,
    period: new Date().toISOString().slice(0, 7), // YYYY-MM format
    category: '',
    description: ''
  });
  const [analysis, setAnalysis] = useState<BudgetAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchAnalysis = async () => {
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
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to fetch budget analysis:', errorData?.detail || response.statusText);
      }
    } catch (error) {
      console.error('Error fetching analysis:', error);
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Budget Tracking</h2>

      {/* Budget Update Form */}
      <div className="space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Actual Cost
          </label>
          <input
            type="number"
            value={budgetUpdate.actual_cost}
            onChange={e => setBudgetUpdate(prev => ({ ...prev, actual_cost: parseFloat(e.target.value) || 0 }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
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
          />
        </div>

        <button
          onClick={updateBudget}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Budget'}
        </button>
      </div>

      {/* Budget Analysis */}
      {analysis && (
        <div className="mt-8 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Budget Analysis</h3>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-2xl font-bold text-indigo-600">
                ${(analysis?.total_budget || 0).toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total Actual</p>
              <p className="text-2xl font-bold text-indigo-600">
                ${(analysis?.total_actual || 0).toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Variance</p>
              <p className={`text-2xl font-bold ${(analysis?.variance?.amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${(analysis?.variance?.amount || 0).toFixed(2)} ({(analysis?.variance?.percentage || 0).toFixed(1)}%)
              </p>
            </div>
          </div>

          {/* Category Analysis */}
          {analysis.category_analysis && (
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Category Breakdown</h4>
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
              <h4 className="font-semibold text-gray-900 mb-3">3-Month Forecast</h4>
              <div className="grid grid-cols-3 gap-4">
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
      )}
    </div>
  );
}
