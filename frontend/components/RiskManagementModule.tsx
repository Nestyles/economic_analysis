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

interface RiskFactor {
  name: string;
  min_value: number;
  max_value: number;
  base_value: number;
  impact_type: 'cost' | 'schedule' | 'quality';
}

interface SensitivityInput {
  risk_factors: RiskFactor[];
  base_cost: number;
  base_schedule: number;
}

interface SensitivityResult {
  min_impact: number;
  max_impact: number;
  range: number;
}

interface DecisionNode {
  id: string;
  name: string;
  type: 'decision' | 'chance' | 'outcome';
  probability?: number;
  cost?: number;
  value?: number;
  children?: DecisionNode[];
}

interface MonteCarloInput {
  iterations: number;
  variables: {
    name: string;
    distribution: 'normal' | 'uniform' | 'triangular';
    parameters: number[];
  }[];
}

interface MonteCarloResult {
  iterations: number;
  statistics: {
    [key: string]: {
      mean: number;
      std: number;
      percentiles: {
        '10': number;
        '25'?: number;
        '50': number;
        '75'?: number;
        '90': number;
      };
    };
  };
}

interface RiskAnalysisResults {
  sensitivity_analysis?: {
    base_value: number;
    variables: {
      [key: string]: SensitivityResult;
    };
  };
  monte_carlo?: MonteCarloResult;
  decision_tree_value?: number;
}

export default function RiskManagementModule({ projectId }: { projectId: number }) {
  const [activeTab, setActiveTab] = useState<'sensitivity' | 'decision-tree' | 'monte-carlo' | 'results'>('sensitivity');
  const [loading, setLoading] = useState(false);
  
  // Sensitivity Analysis State
  const [sensitivityInput, setSensitivityInput] = useState<SensitivityInput>({
    risk_factors: [
      {
        name: 'Development Cost',
        min_value: 0.8,
        max_value: 1.5,
        base_value: 1.0,
        impact_type: 'cost'
      },
      {
        name: 'Schedule Risk',
        min_value: 0.9,
        max_value: 1.3,
        base_value: 1.0,
        impact_type: 'schedule'
      }
    ],
    base_cost: 100000,
    base_schedule: 12
  });

  // Decision Tree State
  const [decisionTree, setDecisionTree] = useState<DecisionNode>({
    id: 'root',
    name: 'Project Decision',
    type: 'decision',
    children: [
      {
        id: 'option1',
        name: 'In-house Development',
        type: 'chance',
        children: [
          { id: 'success1', name: 'Success', type: 'outcome', probability: 0.7, cost: 100000, value: 200000 },
          { id: 'failure1', name: 'Failure', type: 'outcome', probability: 0.3, cost: 120000, value: 50000 }
        ]
      },
      {
        id: 'option2',
        name: 'Outsourced Development',
        type: 'chance',
        children: [
          { id: 'success2', name: 'Success', type: 'outcome', probability: 0.8, cost: 80000, value: 180000 },
          { id: 'failure2', name: 'Failure', type: 'outcome', probability: 0.2, cost: 90000, value: 40000 }
        ]
      }
    ]
  });

  // Monte Carlo State
  const [monteCarloInput, setMonteCarloInput] = useState<MonteCarloInput>({
    iterations: 10000,
    variables: [
      {
        name: 'Development Cost',
        distribution: 'normal',
        parameters: [100000, 15000] // mean, std_dev
      },
      {
        name: 'Revenue',
        distribution: 'triangular',
        parameters: [150000, 200000, 300000] // min, mode, max
      }
    ]
  });

  // Results State
  const [analysisResults, setAnalysisResults] = useState<RiskAnalysisResults | null>(null);

  const runSensitivityAnalysis = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      
      // Transform data to match backend API
      const variables: { [key: string]: { min: number; max: number } } = {};
      sensitivityInput.risk_factors.forEach(factor => {
        variables[factor.name] = {
          min: factor.min_value * sensitivityInput.base_cost,
          max: factor.max_value * sensitivityInput.base_cost
        };
      });

      const requestData = {
        base_value: sensitivityInput.base_cost,
        variables: variables,
        iterations: 1000
      };

      const response = await fetch(`http://localhost:8000/risk/${projectId}/risk/sensitivity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const results = await response.json();
        setAnalysisResults(prev => ({ ...prev, sensitivity_analysis: results }));
        setActiveTab('results');
        alert('Sensitivity analysis completed successfully!');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to run sensitivity analysis');
      }
    } catch (error) {
      console.error('Error running sensitivity analysis:', error);
      alert('An error occurred while running sensitivity analysis');
    } finally {
      setLoading(false);
    }
  };

  const runDecisionTreeAnalysis = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const response = await fetch(`http://localhost:8000/risk/${projectId}/risk/decision-tree`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(decisionTree)
      });

      if (response.ok) {
        const results = await response.json();
        setAnalysisResults(prev => ({ ...prev, decision_tree_value: results.expected_value }));
        setActiveTab('results');
        alert('Decision tree analysis completed successfully!');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to run decision tree analysis');
      }
    } catch (error) {
      console.error('Error running decision tree analysis:', error);
      alert('An error occurred while running decision tree analysis');
    } finally {
      setLoading(false);
    }
  };

  const runMonteCarloSimulation = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      
      // Transform data to match backend API
      const variables: { [key: string]: { min: number; max: number } } = {};
      monteCarloInput.variables.forEach(variable => {
        if (variable.distribution === 'uniform') {
          variables[variable.name] = {
            min: variable.parameters[0],
            max: variable.parameters[1]
          };
        } else if (variable.distribution === 'normal') {
          // For normal distribution, use mean ± 2*std as min/max
          const mean = variable.parameters[0];
          const std = variable.parameters[1];
          variables[variable.name] = {
            min: mean - 2 * std,
            max: mean + 2 * std
          };
        } else if (variable.distribution === 'triangular') {
          variables[variable.name] = {
            min: variable.parameters[0],
            max: variable.parameters[2]
          };
        }
      });

      const requestData = {
        variables: variables,
        iterations: monteCarloInput.iterations
      };

      const response = await fetch(`http://localhost:8000/risk/${projectId}/risk/monte-carlo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const results = await response.json();
        setAnalysisResults(prev => ({ ...prev, monte_carlo: results }));
        setActiveTab('results');
        alert('Monte Carlo simulation completed successfully!');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to run Monte Carlo simulation');
      }
    } catch (error) {
      console.error('Error running Monte Carlo simulation:', error);
      alert('An error occurred while running Monte Carlo simulation');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Risk Management & Analysis</h2>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'sensitivity', label: 'Sensitivity Analysis', icon: '📊' },
            { id: 'decision-tree', label: 'Decision Trees', icon: '🌳' },
            { id: 'monte-carlo', label: 'Monte Carlo', icon: '🎲' },
            { id: 'results', label: 'Results & Reports', icon: '📈' }
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

      {/* Sensitivity Analysis Tab */}
      {activeTab === 'sensitivity' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Sensitivity Analysis</h3>
              <p className="text-sm text-gray-600">Analyze how sensitive your project outcomes are to changes in key variables</p>
            </div>
            <Button onClick={runSensitivityAnalysis} disabled={loading}>
              {loading ? 'Running Analysis...' : 'Run Sensitivity Analysis'}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Base Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Cost ($)
                  </label>
                  <input
                    type="number"
                    value={sensitivityInput.base_cost}
                    onChange={e => setSensitivityInput(prev => ({ ...prev, base_cost: parseFloat(e.target.value) || 0 }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Schedule (months)
                  </label>
                  <input
                    type="number"
                    value={sensitivityInput.base_schedule}
                    onChange={e => setSensitivityInput(prev => ({ ...prev, base_schedule: parseFloat(e.target.value) || 0 }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Factors</CardTitle>
              <CardDescription>Define the risk factors and their potential impact ranges</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {sensitivityInput.risk_factors.map((factor, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Factor Name</label>
                        <input
                          type="text"
                          value={factor.name}
                          onChange={e => {
                            const newFactors = [...sensitivityInput.risk_factors];
                            newFactors[index].name = e.target.value;
                            setSensitivityInput(prev => ({ ...prev, risk_factors: newFactors }));
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                        <input
                          type="number"
                          step="0.1"
                          value={factor.min_value}
                          onChange={e => {
                            const newFactors = [...sensitivityInput.risk_factors];
                            newFactors[index].min_value = parseFloat(e.target.value) || 0;
                            setSensitivityInput(prev => ({ ...prev, risk_factors: newFactors }));
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Value</label>
                        <input
                          type="number"
                          step="0.1"
                          value={factor.max_value}
                          onChange={e => {
                            const newFactors = [...sensitivityInput.risk_factors];
                            newFactors[index].max_value = parseFloat(e.target.value) || 0;
                            setSensitivityInput(prev => ({ ...prev, risk_factors: newFactors }));
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Base Value</label>
                        <input
                          type="number"
                          step="0.1"
                          value={factor.base_value}
                          onChange={e => {
                            const newFactors = [...sensitivityInput.risk_factors];
                            newFactors[index].base_value = parseFloat(e.target.value) || 0;
                            setSensitivityInput(prev => ({ ...prev, risk_factors: newFactors }));
                          }}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Impact</label>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          factor.impact_type === 'cost' ? 'bg-red-100 text-red-800' :
                          factor.impact_type === 'schedule' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {factor.impact_type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}      {/* Decision Tree Tab */}
      {activeTab === 'decision-tree' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Decision Tree Analysis</h3>
              <p className="text-sm text-gray-600">Model decision scenarios with probabilities and expected values</p>
            </div>
            <div className="flex space-x-2">
              <Button 
                onClick={() => {
                  // Add new decision option
                  const newOption: DecisionNode = {
                    id: `option${Date.now()}`,
                    name: 'New Option',
                    type: 'chance',
                    children: [
                      { 
                        id: `success${Date.now()}`, 
                        name: 'Success', 
                        type: 'outcome', 
                        probability: 0.7, 
                        cost: 100000, 
                        value: 200000 
                      },
                      { 
                        id: `failure${Date.now()}`, 
                        name: 'Failure', 
                        type: 'outcome', 
                        probability: 0.3, 
                        cost: 120000, 
                        value: 50000 
                      }
                    ]
                  };
                  setDecisionTree(prev => ({
                    ...prev,
                    children: [...(prev.children || []), newOption]
                  }));
                }}
                variant="outline"
                size="sm"
              >
                Add Option
              </Button>
              <Button onClick={runDecisionTreeAnalysis} disabled={loading}>
                {loading ? 'Analyzing...' : 'Analyze Decision Tree'}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Decision Tree Configuration</CardTitle>
              <CardDescription>Configure your decision tree nodes and probabilities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Root Decision Node */}
              <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                <div className="flex items-center mb-4">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    D
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={decisionTree.name}
                      onChange={(e) => setDecisionTree(prev => ({ ...prev, name: e.target.value }))}
                      className="font-semibold text-blue-900 bg-transparent border-b border-blue-300 focus:border-blue-500 outline-none text-lg"
                    />
                    <div className="text-sm text-blue-600">Decision Node</div>
                  </div>
                </div>

                {/* Decision Options */}
                <div className="space-y-4 ml-11">
                  {decisionTree.children?.map((option, optionIndex) => (
                    <div key={option.id} className="p-4 border border-green-200 rounded-lg bg-green-50">
                      <div className="flex items-center mb-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">
                          C
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={option.name}
                            onChange={(e) => {
                              const newTree = { ...decisionTree };
                              if (newTree.children) {
                                newTree.children[optionIndex].name = e.target.value;
                                setDecisionTree(newTree);
                              }
                            }}
                            className="font-medium bg-transparent border-b border-green-300 focus:border-green-500 outline-none"
                          />
                          <div className="text-sm text-green-600">Chance Node</div>
                        </div>
                        <Button
                          onClick={() => {
                            const newTree = { ...decisionTree };
                            if (newTree.children) {
                              newTree.children.splice(optionIndex, 1);
                              setDecisionTree(newTree);
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>

                      {/* Outcomes */}
                      <div className="space-y-2 ml-9">
                        {option.children?.map((outcome, outcomeIndex) => (
                          <div key={outcome.id} className="flex items-center space-x-4 p-3 border border-gray-200 rounded bg-white">
                            <div className="w-4 h-4 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs">
                              O
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                value={outcome.name}
                                onChange={(e) => {
                                  const newTree = { ...decisionTree };
                                  if (newTree.children?.[optionIndex].children) {
                                    newTree.children[optionIndex].children![outcomeIndex].name = e.target.value;
                                    setDecisionTree(newTree);
                                  }
                                }}
                                className="text-sm bg-transparent border-b border-gray-300 focus:border-gray-500 outline-none w-full"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-500">Prob:</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="1"
                                value={outcome.probability}
                                onChange={(e) => {
                                  const newTree = { ...decisionTree };
                                  if (newTree.children?.[optionIndex].children) {
                                    newTree.children[optionIndex].children![outcomeIndex].probability = parseFloat(e.target.value) || 0;
                                    setDecisionTree(newTree);
                                  }
                                }}
                                className="w-16 text-xs p-1 border border-gray-300 rounded"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-500">Cost:</label>
                              <input
                                type="number"
                                value={outcome.cost}
                                onChange={(e) => {
                                  const newTree = { ...decisionTree };
                                  if (newTree.children?.[optionIndex].children) {
                                    newTree.children[optionIndex].children![outcomeIndex].cost = parseFloat(e.target.value) || 0;
                                    setDecisionTree(newTree);
                                  }
                                }}
                                className="w-20 text-xs p-1 border border-gray-300 rounded"
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-gray-500">Value:</label>
                              <input
                                type="number"
                                value={outcome.value}
                                onChange={(e) => {
                                  const newTree = { ...decisionTree };
                                  if (newTree.children?.[optionIndex].children) {
                                    newTree.children[optionIndex].children![outcomeIndex].value = parseFloat(e.target.value) || 0;
                                    setDecisionTree(newTree);
                                  }
                                }}
                                className="w-20 text-xs p-1 border border-gray-300 rounded"
                              />
                            </div>
                            <Button
                              onClick={() => {
                                const newTree = { ...decisionTree };
                                if (newTree.children?.[optionIndex].children) {
                                  newTree.children[optionIndex].children!.splice(outcomeIndex, 1);
                                  setDecisionTree(newTree);
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 text-xs"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                        
                        {/* Add Outcome Button */}
                        <Button
                          onClick={() => {
                            const newOutcome: DecisionNode = {
                              id: `outcome${Date.now()}`,
                              name: 'New Outcome',
                              type: 'outcome',
                              probability: 0.5,
                              cost: 100000,
                              value: 150000
                            };
                            const newTree = { ...decisionTree };
                            if (newTree.children?.[optionIndex].children) {
                              newTree.children[optionIndex].children!.push(newOutcome);
                              setDecisionTree(newTree);
                            }
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full border-dashed"
                        >
                          Add Outcome
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Expected Value Calculation Preview */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Expected Value Preview</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {decisionTree.children?.map((option) => {
                    const expectedValue = option.children?.reduce((sum, outcome) => 
                      sum + (outcome.probability || 0) * ((outcome.value || 0) - (outcome.cost || 0)), 0
                    ) || 0;
                    
                    const totalProbability = option.children?.reduce((sum, outcome) => 
                      sum + (outcome.probability || 0), 0
                    ) || 0;

                    const isValidProbability = Math.abs(totalProbability - 1.0) < 0.01;
                    
                    return (
                      <div key={option.id} className={`p-3 rounded border ${
                        isValidProbability ? 'bg-white border-gray-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="text-sm font-medium text-gray-900">{option.name}</div>
                        <div className={`text-lg font-bold ${
                          expectedValue > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(expectedValue)}
                        </div>
                        <div className="text-xs text-gray-500">Expected Net Value</div>
                        {!isValidProbability && (
                          <div className="text-xs text-red-600 mt-1">
                            ⚠️ Probabilities sum to {totalProbability.toFixed(2)} (should be 1.0)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Best Option Recommendation */}
                {decisionTree.children && decisionTree.children.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
                    <div className="text-sm font-medium text-blue-900">Recommendation</div>
                    <div className="text-sm text-blue-800">
                      {(() => {
                        const validOptions = decisionTree.children?.filter(option => {
                          const totalProb = option.children?.reduce((sum, outcome) => sum + (outcome.probability || 0), 0) || 0;
                          return Math.abs(totalProb - 1.0) < 0.01;
                        }) || [];

                        if (validOptions.length === 0) {
                          return "Please ensure all probability distributions sum to 1.0 for valid analysis.";
                        }

                        const bestOption = validOptions.reduce((best, current) => {
                          const currentEV = current.children?.reduce((sum, outcome) => 
                            sum + (outcome.probability || 0) * ((outcome.value || 0) - (outcome.cost || 0)), 0
                          ) || 0;
                          const bestEV = best.children?.reduce((sum, outcome) => 
                            sum + (outcome.probability || 0) * ((outcome.value || 0) - (outcome.cost || 0)), 0
                          ) || 0;
                          return currentEV > bestEV ? current : best;
                        });

                        const bestEV = bestOption.children?.reduce((sum, outcome) => 
                          sum + (outcome.probability || 0) * ((outcome.value || 0) - (outcome.cost || 0)), 0
                        ) || 0;

                        return `Based on expected values, "${bestOption.name}" is the optimal choice with an expected net value of ${formatCurrency(bestEV)}.`;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Decision Tree Validation */}
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h5 className="font-medium text-yellow-800 mb-2">⚠️ Validation Checklist</h5>
                <div className="space-y-1 text-sm text-yellow-700">
                  {decisionTree.children?.map((option, index) => {
                    const totalProb = option.children?.reduce((sum, outcome) => sum + (outcome.probability || 0), 0) || 0;
                    const isValid = Math.abs(totalProb - 1.0) < 0.01;
                    return (
                      <div key={option.id} className="flex items-center">
                        <span className={isValid ? 'text-green-600' : 'text-red-600'}>
                          {isValid ? '✓' : '✗'}
                        </span>
                        <span className="ml-2">
                          {option.name}: Probabilities sum to {totalProb.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monte Carlo Tab */}
      {activeTab === 'monte-carlo' && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎲</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Monte Carlo Simulation</h3>
          <p className="text-gray-600 mb-6">Advanced Monte Carlo simulation functionality coming soon</p>
          <Button onClick={runMonteCarloSimulation} disabled={loading}>
            {loading ? 'Running Simulation...' : 'Run Monte Carlo Simulation'}
          </Button>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Analysis Results</h3>

          {!analysisResults ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📈</div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">No Analysis Results Yet</h4>
              <p className="text-gray-600 mb-6">Run one of the risk analysis methods to see results here</p>
              <div className="space-x-2">
                <Button onClick={() => setActiveTab('sensitivity')}>Sensitivity Analysis</Button>
                <Button onClick={() => setActiveTab('decision-tree')} variant="outline">Decision Trees</Button>
                <Button onClick={() => setActiveTab('monte-carlo')} variant="outline">Monte Carlo</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {analysisResults.sensitivity_analysis && (
                <Card>
                  <CardHeader>
                    <CardTitle>📊 Sensitivity Analysis Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(analysisResults.sensitivity_analysis.variables || {}).map(([factorName, result]) => (
                        <div key={factorName} className="p-4 border border-gray-200 rounded-lg">
                          <div className="flex justify-between items-center">
                            <h5 className="font-medium text-gray-900">{factorName}</h5>
                            <span className={`px-2 py-1 rounded text-sm font-medium ${
                              Math.abs(result.range) > 50000 
                                ? 'bg-red-100 text-red-800' 
                                : Math.abs(result.range) > 20000
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {Math.abs(result.range) > 50000 ? 'High' : Math.abs(result.range) > 20000 ? 'Medium' : 'Low'} Impact
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Min Impact:</span>
                              <span className="ml-2 font-medium">{formatCurrency(result.min_impact)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Max Impact:</span>
                              <span className="ml-2 font-medium">{formatCurrency(result.max_impact)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Range:</span>
                              <span className="ml-2 font-medium">{formatCurrency(result.range)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}              {analysisResults.decision_tree_value && (
                <Card>
                  <CardHeader>
                    <CardTitle>🌳 Decision Tree Analysis Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Overall Expected Value */}
                      <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          {formatCurrency(analysisResults.decision_tree_value)}
                        </div>
                        <div className="text-gray-600">Expected Value of Optimal Decision</div>
                      </div>

                      {/* Detailed Breakdown */}
                      <div className="space-y-4">
                        <h5 className="font-medium text-gray-900">Decision Options Analysis</h5>
                        {decisionTree.children?.map((option, index) => {
                          const expectedValue = option.children?.reduce((sum, outcome) => 
                            sum + (outcome.probability || 0) * ((outcome.value || 0) - (outcome.cost || 0)), 0
                          ) || 0;
                          
                          const totalCost = option.children?.reduce((sum, outcome) => 
                            sum + (outcome.probability || 0) * (outcome.cost || 0), 0
                          ) || 0;
                          
                          const totalValue = option.children?.reduce((sum, outcome) => 
                            sum + (outcome.probability || 0) * (outcome.value || 0), 0
                          ) || 0;

                          const isOptimal = expectedValue === Math.max(...(decisionTree.children?.map(opt => 
                            opt.children?.reduce((sum, outcome) => 
                              sum + (outcome.probability || 0) * ((outcome.value || 0) - (outcome.cost || 0)), 0
                            ) || 0
                          ) || []));

                          return (
                            <div key={option.id} className={`p-4 rounded-lg border ${
                              isOptimal ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                            }`}>
                              <div className="flex items-center justify-between mb-3">
                                <h6 className="font-medium text-gray-900">{option.name}</h6>
                                {isOptimal && (
                                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                    OPTIMAL
                                  </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                  <div className="text-xs text-gray-500">Expected Cost</div>
                                  <div className="font-medium text-red-600">{formatCurrency(totalCost)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">Expected Value</div>
                                  <div className="font-medium text-green-600">{formatCurrency(totalValue)}</div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500">Net Expected Value</div>
                                  <div className={`font-medium ${expectedValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {formatCurrency(expectedValue)}
                                  </div>
                                </div>
                              </div>

                              {/* Outcomes breakdown */}
                              <div className="space-y-2">
                                <div className="text-xs font-medium text-gray-700">Outcomes:</div>
                                {option.children?.map((outcome) => (
                                  <div key={outcome.id} className="flex items-center justify-between text-xs text-gray-600 bg-white p-2 rounded">
                                    <span>{outcome.name}</span>
                                    <span>P: {(outcome.probability || 0).toFixed(1)}</span>
                                    <span>Cost: {formatCurrency(outcome.cost || 0)}</span>
                                    <span>Value: {formatCurrency(outcome.value || 0)}</span>
                                    <span className={`font-medium ${
                                      ((outcome.value || 0) - (outcome.cost || 0)) >= 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      Net: {formatCurrency((outcome.value || 0) - (outcome.cost || 0))}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Risk Assessment */}
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h5 className="font-medium text-yellow-800 mb-2">Risk Assessment</h5>
                        <div className="space-y-2 text-sm text-yellow-700">
                          {decisionTree.children?.map((option) => {
                            const outcomes = option.children || [];
                            const worstCase = Math.min(...outcomes.map(o => (o.value || 0) - (o.cost || 0)));
                            const bestCase = Math.max(...outcomes.map(o => (o.value || 0) - (o.cost || 0)));
                            const range = bestCase - worstCase;
                            
                            return (
                              <div key={option.id}>
                                <strong>{option.name}:</strong> Risk range from {formatCurrency(worstCase)} to {formatCurrency(bestCase)} 
                                (spread: {formatCurrency(range)})
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Sensitivity to Probabilities */}
                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <h5 className="font-medium text-purple-800 mb-2">Probability Sensitivity</h5>
                        <div className="text-sm text-purple-700">
                          The analysis shows how sensitive the decision is to changes in outcome probabilities. 
                          Small changes in probabilities for high-impact outcomes can significantly affect the optimal choice.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {analysisResults.monte_carlo && (
                <Card>
                  <CardHeader>
                    <CardTitle>🎲 Monte Carlo Simulation Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {Object.entries(analysisResults.monte_carlo.statistics || {}).map(([varName, stats]) => (
                        <div key={varName} className="p-4 border border-gray-200 rounded-lg">
                          <h5 className="font-medium text-gray-900 mb-3">{varName}</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Mean:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.mean)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Std Dev:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.std)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">10th Percentile:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.percentiles['10'])}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">90th Percentile:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.percentiles['90'])}</span>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">25th Percentile:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.percentiles['25'] || 0)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Median:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.percentiles['50'])}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">75th Percentile:</span>
                              <span className="ml-2 font-medium">{formatCurrency(stats.percentiles['75'] || 0)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center mb-2">
                          <div className="text-blue-600 font-medium">Simulation Summary</div>
                        </div>
                        <div className="text-sm text-blue-800">
                          Completed {analysisResults.monte_carlo.iterations} iterations to model uncertainty across {Object.keys(analysisResults.monte_carlo.statistics || {}).length} variables.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
