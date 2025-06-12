import { useState } from 'react';
import { getAuthToken } from '../lib/auth';

interface RiskVariable {
  name: string;
  min: number;
  max: number;
  most_likely?: number;
}

interface SensitivityAnalysisInput {
  base_value: number;
  variables: { [key: string]: { min: number; max: number } };
  iterations: number;
}

interface DecisionTreeNode {
  name: string;
  probability: number;
  value: number;
  children?: DecisionTreeNode[];
}

interface MonteCarloInput {
  variables: { [key: string]: { min: number; max: number } };
  iterations: number;
  correlation_matrix?: { [key: string]: { [key: string]: number } };
}

export default function RiskManagementModule({ projectId }: { projectId: number }) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'sensitivity' | 'decision-tree' | 'monte-carlo'>('sensitivity');
  
  // Sensitivity Analysis State
  const [sensitivityInput, setSensitivityInput] = useState<SensitivityAnalysisInput>({
    base_value: 0,
    variables: {},
    iterations: 1000
  });
  const [sensitivityResults, setSensitivityResults] = useState(null);

  // Decision Tree State
  const [decisionTree, setDecisionTree] = useState<DecisionTreeNode>({
    name: 'Root',
    probability: 1,
    value: 0
  });
  const [treeResults, setTreeResults] = useState(null);

  // Monte Carlo State
  const [monteCarloInput, setMonteCarloInput] = useState<MonteCarloInput>({
    variables: {},
    iterations: 1000
  });
  const [monteCarloResults, setMonteCarloResults] = useState(null);

  const runSensitivityAnalysis = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:8000/projects/${projectId}/risk/sensitivity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(sensitivityInput)
      });

      if (response.ok) {
        const data = await response.json();
        setSensitivityResults(data);
      } else {
        console.error('Failed to run sensitivity analysis');
      }
    } catch (error) {
      console.error('Error running sensitivity analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const runDecisionTreeAnalysis = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:8000/projects/${projectId}/risk/decision-tree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(decisionTree)
      });

      if (response.ok) {
        const data = await response.json();
        setTreeResults(data);
      } else {
        console.error('Failed to analyze decision tree');
      }
    } catch (error) {
      console.error('Error analyzing decision tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const runMonteCarloSimulation = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:8000/projects/${projectId}/risk/monte-carlo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(monteCarloInput)
      });

      if (response.ok) {
        const data = await response.json();
        setMonteCarloResults(data);
      } else {
        console.error('Failed to run Monte Carlo simulation');
      }
    } catch (error) {
      console.error('Error running Monte Carlo simulation:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add/Edit Variable for Sensitivity Analysis or Monte Carlo
  const addVariable = (name: string, min: number, max: number, analysis: 'sensitivity' | 'monte-carlo') => {
    if (analysis === 'sensitivity') {
      setSensitivityInput(prev => ({
        ...prev,
        variables: {
          ...prev.variables,
          [name]: { min, max }
        }
      }));
    } else {
      setMonteCarloInput(prev => ({
        ...prev,
        variables: {
          ...prev.variables,
          [name]: { min, max }
        }
      }));
    }
  };

  // Add node to decision tree
  const addTreeNode = (parentName: string, node: Omit<DecisionTreeNode, 'children'>) => {
    const addNodeToTree = (tree: DecisionTreeNode): DecisionTreeNode => {
      if (tree.name === parentName) {
        return {
          ...tree,
          children: [...(tree.children || []), { ...node, children: [] }]
        };
      }
      if (tree.children) {
        return {
          ...tree,
          children: tree.children.map(child => addNodeToTree(child))
        };
      }
      return tree;
    };

    setDecisionTree(prev => addNodeToTree(prev));
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Risk Management</h2>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['sensitivity', 'decision-tree', 'monte-carlo'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Sensitivity Analysis Tab */}
      {activeTab === 'sensitivity' && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Value
              </label>
              <input
                type="number"
                value={sensitivityInput.base_value}
                onChange={e => setSensitivityInput(prev => ({ ...prev, base_value: parseFloat(e.target.value) || 0 }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            {/* Variable List */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Variables</h4>
              {Object.entries(sensitivityInput.variables).map(([name, { min, max }]) => (
                <div key={name} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={name}
                    readOnly
                    className="block w-1/3 rounded-md border-gray-300 shadow-sm bg-gray-50 sm:text-sm"
                  />
                  <input
                    type="number"
                    value={min}
                    onChange={e => addVariable(name, parseFloat(e.target.value) || 0, max, 'sensitivity')}
                    placeholder="Min"
                    className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <input
                    type="number"
                    value={max}
                    onChange={e => addVariable(name, min, parseFloat(e.target.value) || 0, 'sensitivity')}
                    placeholder="Max"
                    className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={runSensitivityAnalysis}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Run Sensitivity Analysis'}
            </button>
          </div>

          {/* Results */}
          {sensitivityResults && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Results</h4>
              {/* Display tornado diagram or other visualizations here */}
            </div>
          )}
        </div>
      )}

      {/* Decision Tree Tab */}
      {activeTab === 'decision-tree' && (
        <div className="space-y-6">
          <div className="space-y-4">
            {/* Tree Editor */}
            <div className="border rounded-md p-4">
              <h4 className="font-medium text-gray-900 mb-3">Decision Tree Editor</h4>
              {/* Tree visualization and editor components */}
            </div>

            <button
              onClick={runDecisionTreeAnalysis}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Analyze Decision Tree'}
            </button>
          </div>

          {/* Results */}
          {treeResults && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Results</h4>
              {/* Display tree analysis results */}
            </div>
          )}
        </div>
      )}

      {/* Monte Carlo Tab */}
      {activeTab === 'monte-carlo' && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Iterations
              </label>
              <input
                type="number"
                value={monteCarloInput.iterations}
                onChange={e => setMonteCarloInput(prev => ({ ...prev, iterations: parseInt(e.target.value) || 1000 }))}
                min="100"
                max="10000"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            {/* Variable List */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Variables</h4>
              {Object.entries(monteCarloInput.variables).map(([name, { min, max }]) => (
                <div key={name} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={name}
                    readOnly
                    className="block w-1/3 rounded-md border-gray-300 shadow-sm bg-gray-50 sm:text-sm"
                  />
                  <input
                    type="number"
                    value={min}
                    onChange={e => addVariable(name, parseFloat(e.target.value) || 0, max, 'monte-carlo')}
                    placeholder="Min"
                    className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <input
                    type="number"
                    value={max}
                    onChange={e => addVariable(name, min, parseFloat(e.target.value) || 0, 'monte-carlo')}
                    placeholder="Max"
                    className="block w-1/3 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={runMonteCarloSimulation}
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Simulating...' : 'Run Monte Carlo Simulation'}
            </button>
          </div>

          {/* Results */}
          {monteCarloResults && (
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Results</h4>
              {/* Display simulation results and distributions */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
