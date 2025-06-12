import { useState } from 'react';
import { getAuthToken } from '../lib/auth';

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

export default function FinancialMetricsModule({ projectId }: { projectId: number }) {
  const [input, setInput] = useState<FinancialInput>({
    initial_investment: 0,
    cash_flows: [],
    discount_rate: 10,
  });
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const calculateMetrics = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:8000/projects/${projectId}/financials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(input)
      });

      if (response.ok) {
        const data = await response.json();
        setMetrics(data);
      } else {
        console.error('Failed to calculate financial metrics');
      }
    } catch (error) {
      console.error('Error calculating metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FinancialInput, value: string) => {
    if (field === 'cash_flows') {
      const flows = value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
      setInput(prev => ({ ...prev, cash_flows: flows }));
    } else if (field === 'initial_investment' || field === 'discount_rate') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        setInput(prev => ({ ...prev, [field]: num }));
      }
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Financial Metrics</h2>
      
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Initial Investment
          </label>
          <input
            type="number"
            value={input.initial_investment}
            onChange={e => handleInputChange('initial_investment', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cash Flows (comma-separated)
          </label>
          <input
            type="text"
            value={input.cash_flows.join(', ')}
            onChange={e => handleInputChange('cash_flows', e.target.value)}
            placeholder="1000, 2000, 3000"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Discount Rate (%)
          </label>
          <input
            type="number"
            value={input.discount_rate}
            onChange={e => handleInputChange('discount_rate', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>

        <button
          onClick={calculateMetrics}
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? 'Calculating...' : 'Calculate Metrics'}
        </button>
      </div>

      {metrics && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Results</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">ROI</p>
              <p className="text-2xl font-bold text-indigo-600">{metrics.roi.toFixed(2)}%</p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">NPV</p>
              <p className="text-2xl font-bold text-indigo-600">
                ${metrics.npv.toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">IRR</p>
              <p className="text-2xl font-bold text-indigo-600">
                {metrics.irr ? `${metrics.irr.toFixed(2)}%` : 'N/A'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Payback Period</p>
              <p className="text-2xl font-bold text-indigo-600">
                {metrics.payback_period ? `${metrics.payback_period.toFixed(2)} years` : 'N/A'}
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Details</h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p>Total Investment: ${metrics.details.total_investment.toFixed(2)}</p>
              <p>Total Returns: ${metrics.details.total_returns.toFixed(2)}</p>
              <p>Discount Rate: {metrics.details.discount_rate}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
