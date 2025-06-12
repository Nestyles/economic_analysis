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

interface Resource {
  id: string;
  name: string;
  type: 'human' | 'equipment' | 'material';
  capacity: number;
  cost_per_hour: number;
  availability: {
    start_date: string;
    end_date: string;
    daily_hours: number;
  };
}

interface Task {
  id: string;
  name: string;
  duration: number; // hours
  required_resources: {
    resource_id: string;
    quantity: number;
  }[];
  dependencies: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  earliest_start?: string;
  latest_finish?: string;
  is_critical?: boolean;
}

interface ResourceAllocation {
  task_id: string;
  resource_id: string;
  start_date: string;
  end_date: string;
  hours_allocated: number;
  cost: number;
}

interface OptimizationScenario {
  name: string;
  objective: 'minimize_cost' | 'minimize_duration' | 'balance_resources' | 'maximize_utilization';
  constraints: {
    max_budget?: number;
    max_duration?: number;
    resource_utilization_target?: number;
  };
  weights: {
    cost_weight: number;
    time_weight: number;
    resource_weight: number;
  };
}

interface OptimizationResult {
  scenario_name: string;
  total_cost: number;
  total_duration: number;
  resource_utilization: { [resource_id: string]: number };
  allocations: ResourceAllocation[];
  critical_path: string[];
  resource_conflicts: {
    resource_id: string;
    over_allocation_periods: { start: string; end: string; excess: number }[];
  }[];
  recommendations: string[];
}

export default function ResourceOptimizationModule({ projectId }: { projectId: number }) {
  const [activeTab, setActiveTab] = useState<'resources' | 'tasks' | 'scenarios' | 'optimization' | 'results'>('resources');
  const [loading, setLoading] = useState(false);

  // State Management
  const [resources, setResources] = useState<Resource[]>([
    {
      id: 'res1',
      name: 'Senior Developer',
      type: 'human',
      capacity: 8,
      cost_per_hour: 75,
      availability: {
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        daily_hours: 8
      }
    },
    {
      id: 'res2',
      name: 'Junior Developer',
      type: 'human',
      capacity: 8,
      cost_per_hour: 45,
      availability: {
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        daily_hours: 8
      }
    }
  ]);

  const [tasks, setTasks] = useState<Task[]>([
    {
      id: 'task1',
      name: 'Requirements Analysis',
      duration: 40,
      required_resources: [{ resource_id: 'res1', quantity: 1 }],
      dependencies: [],
      priority: 'high'
    },
    {
      id: 'task2',
      name: 'System Design',
      duration: 80,
      required_resources: [{ resource_id: 'res1', quantity: 1 }],
      dependencies: ['task1'],
      priority: 'high'
    },
    {
      id: 'task3',
      name: 'Implementation',
      duration: 160,
      required_resources: [
        { resource_id: 'res1', quantity: 1 },
        { resource_id: 'res2', quantity: 2 }
      ],
      dependencies: ['task2'],
      priority: 'medium'
    }
  ]);

  const [scenarios, setScenarios] = useState<OptimizationScenario[]>([
    {
      name: 'Cost Optimization',
      objective: 'minimize_cost',
      constraints: {
        max_duration: 2000
      },
      weights: {
        cost_weight: 0.7,
        time_weight: 0.2,
        resource_weight: 0.1
      }
    },
    {
      name: 'Time Optimization',
      objective: 'minimize_duration',
      constraints: {
        max_budget: 50000
      },
      weights: {
        cost_weight: 0.2,
        time_weight: 0.7,
        resource_weight: 0.1
      }
    }
  ]);

  const [optimizationResults, setOptimizationResults] = useState<OptimizationResult[]>([]);

  // API Functions
  const runOptimization = async (scenarioName: string) => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const scenario = scenarios.find(s => s.name === scenarioName);
      
      if (!scenario) {
        alert('Scenario not found');
        return;
      }

      const requestData = {
        resources,
        tasks,
        scenario,
        project_start_date: '2025-01-01'
      };

      const response = await fetch(`http://localhost:8000/resource/${projectId}/optimize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();
        setOptimizationResults(prev => {
          const filtered = prev.filter(r => r.scenario_name !== scenarioName);
          return [...filtered, result];
        });
        setActiveTab('results');
        alert(`Optimization completed for scenario: ${scenarioName}`);
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to run optimization');
      }
    } catch (error) {
      console.error('Error running optimization:', error);
      alert('An error occurred while running optimization');
    } finally {
      setLoading(false);
    }
  };

  const runResourceLeveling = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const requestData = {
        resources,
        tasks,
        project_start_date: '2025-01-01'
      };

      const response = await fetch(`http://localhost:8000/resource/${projectId}/leveling`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();
        // Update tasks with leveled schedule
        setTasks(result.leveled_tasks);
        alert('Resource leveling completed successfully!');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to run resource leveling');
      }
    } catch (error) {
      console.error('Error running resource leveling:', error);
      alert('An error occurred while running resource leveling');
    } finally {
      setLoading(false);
    }
  };

  const runResourceSmoothing = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const requestData = {
        resources,
        tasks,
        project_start_date: '2025-01-01'
      };

      const response = await fetch(`http://localhost:8000/resource/${projectId}/smoothing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const result = await response.json();
        // Update tasks with smoothed schedule
        setTasks(result.smoothed_tasks);
        alert('Resource smoothing completed successfully!');
      } else {
        const errorData = await response.json().catch(() => null);
        alert(errorData?.detail || 'Failed to run resource smoothing');
      }
    } catch (error) {
      console.error('Error running resource smoothing:', error);
      alert('An error occurred while running resource smoothing');
    } finally {
      setLoading(false);
    }
  };

  // Helper Functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const addResource = () => {
    const newResource: Resource = {
      id: `res${Date.now()}`,
      name: 'New Resource',
      type: 'human',
      capacity: 8,
      cost_per_hour: 50,
      availability: {
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        daily_hours: 8
      }
    };
    setResources(prev => [...prev, newResource]);
  };

  const addTask = () => {
    const newTask: Task = {
      id: `task${Date.now()}`,
      name: 'New Task',
      duration: 40,
      required_resources: [],
      dependencies: [],
      priority: 'medium'
    };
    setTasks(prev => [...prev, newTask]);
  };

  const addScenario = () => {
    const newScenario: OptimizationScenario = {
      name: `Scenario ${scenarios.length + 1}`,
      objective: 'balance_resources',
      constraints: {},
      weights: {
        cost_weight: 0.33,
        time_weight: 0.33,
        resource_weight: 0.34
      }
    };
    setScenarios(prev => [...prev, newScenario]);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Resource Allocation & Optimization</h2>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'resources', label: 'Resources', icon: '👥' },
            { id: 'tasks', label: 'Tasks', icon: '📋' },
            { id: 'scenarios', label: 'Scenarios', icon: '🎯' },
            { id: 'optimization', label: 'Optimization', icon: '⚡' },
            { id: 'results', label: 'Results', icon: '📊' }
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

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Resource Management</h3>
              <p className="text-sm text-gray-600">Define and manage project resources with their capacities and costs</p>
            </div>
            <Button onClick={addResource}>Add Resource</Button>
          </div>

          <div className="space-y-4">
            {resources.map((resource, index) => (
              <Card key={resource.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      <input
                        type="text"
                        value={resource.name}
                        onChange={e => {
                          const newResources = [...resources];
                          newResources[index].name = e.target.value;
                          setResources(newResources);
                        }}
                        className="bg-transparent border-b border-gray-300 focus:border-gray-500 outline-none"
                      />
                    </CardTitle>
                    <Button
                      onClick={() => setResources(resources.filter(r => r.id !== resource.id))}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={resource.type}
                        onChange={e => {
                          const newResources = [...resources];
                          newResources[index].type = e.target.value as 'human' | 'equipment' | 'material';
                          setResources(newResources);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="human">Human</option>
                        <option value="equipment">Equipment</option>
                        <option value="material">Material</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Capacity (hrs/day)</label>
                      <input
                        type="number"
                        value={resource.capacity}
                        onChange={e => {
                          const newResources = [...resources];
                          newResources[index].capacity = parseFloat(e.target.value) || 0;
                          setResources(newResources);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cost per Hour ($)</label>
                      <input
                        type="number"
                        value={resource.cost_per_hour}
                        onChange={e => {
                          const newResources = [...resources];
                          newResources[index].cost_per_hour = parseFloat(e.target.value) || 0;
                          setResources(newResources);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Daily Hours</label>
                      <input
                        type="number"
                        value={resource.availability.daily_hours}
                        onChange={e => {
                          const newResources = [...resources];
                          newResources[index].availability.daily_hours = parseFloat(e.target.value) || 0;
                          setResources(newResources);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Available From</label>
                      <input
                        type="date"
                        value={resource.availability.start_date}
                        onChange={e => {
                          const newResources = [...resources];
                          newResources[index].availability.start_date = e.target.value;
                          setResources(newResources);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Available To</label>
                      <input
                        type="date"
                        value={resource.availability.end_date}
                        onChange={e => {
                          const newResources = [...resources];
                          newResources[index].availability.end_date = e.target.value;
                          setResources(newResources);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Task Management</h3>
              <p className="text-sm text-gray-600">Define project tasks, dependencies, and resource requirements</p>
            </div>
            <Button onClick={addTask}>Add Task</Button>
          </div>

          <div className="space-y-4">
            {tasks.map((task, taskIndex) => (
              <Card key={task.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      <input
                        type="text"
                        value={task.name}
                        onChange={e => {
                          const newTasks = [...tasks];
                          newTasks[taskIndex].name = e.target.value;
                          setTasks(newTasks);
                        }}
                        className="bg-transparent border-b border-gray-300 focus:border-gray-500 outline-none"
                      />
                    </CardTitle>
                    <Button
                      onClick={() => setTasks(tasks.filter(t => t.id !== task.id))}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
                      <input
                        type="number"
                        value={task.duration}
                        onChange={e => {
                          const newTasks = [...tasks];
                          newTasks[taskIndex].duration = parseFloat(e.target.value) || 0;
                          setTasks(newTasks);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={task.priority}
                        onChange={e => {
                          const newTasks = [...tasks];
                          newTasks[taskIndex].priority = e.target.value as 'low' | 'medium' | 'high' | 'critical';
                          setTasks(newTasks);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dependencies</label>
                      <select
                        multiple
                        value={task.dependencies}
                        onChange={e => {
                          const newTasks = [...tasks];
                          newTasks[taskIndex].dependencies = Array.from(e.target.selectedOptions, option => option.value);
                          setTasks(newTasks);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md h-20"
                      >
                        {tasks.filter(t => t.id !== task.id).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Resource Requirements */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Resource Requirements</label>
                      <Button
                        onClick={() => {
                          const newTasks = [...tasks];
                          newTasks[taskIndex].required_resources.push({
                            resource_id: resources[0]?.id || '',
                            quantity: 1
                          });
                          setTasks(newTasks);
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Add Resource
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {task.required_resources.map((req, reqIndex) => (
                        <div key={reqIndex} className="flex items-center space-x-2">
                          <select
                            value={req.resource_id}
                            onChange={e => {
                              const newTasks = [...tasks];
                              newTasks[taskIndex].required_resources[reqIndex].resource_id = e.target.value;
                              setTasks(newTasks);
                            }}
                            className="flex-1 p-2 border border-gray-300 rounded-md"
                          >
                            <option value="">Select Resource</option>
                            {resources.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            value={req.quantity}
                            onChange={e => {
                              const newTasks = [...tasks];
                              newTasks[taskIndex].required_resources[reqIndex].quantity = parseFloat(e.target.value) || 0;
                              setTasks(newTasks);
                            }}
                            placeholder="Quantity"
                            className="w-20 p-2 border border-gray-300 rounded-md"
                          />
                          <Button
                            onClick={() => {
                              const newTasks = [...tasks];
                              newTasks[taskIndex].required_resources.splice(reqIndex, 1);
                              setTasks(newTasks);
                            }}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Scenarios Tab */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Optimization Scenarios</h3>
              <p className="text-sm text-gray-600">Define different optimization objectives and constraints</p>
            </div>
            <Button onClick={addScenario}>Add Scenario</Button>
          </div>

          <div className="space-y-4">
            {scenarios.map((scenario, scenarioIndex) => (
              <Card key={scenarioIndex}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      <input
                        type="text"
                        value={scenario.name}
                        onChange={e => {
                          const newScenarios = [...scenarios];
                          newScenarios[scenarioIndex].name = e.target.value;
                          setScenarios(newScenarios);
                        }}
                        className="bg-transparent border-b border-gray-300 focus:border-gray-500 outline-none"
                      />
                    </CardTitle>
                    <Button
                      onClick={() => setScenarios(scenarios.filter((_, i) => i !== scenarioIndex))}
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Optimization Objective</h4>
                      <select
                        value={scenario.objective}
                        onChange={e => {
                          const newScenarios = [...scenarios];
                          newScenarios[scenarioIndex].objective = e.target.value as any;
                          setScenarios(newScenarios);
                        }}
                        className="w-full p-2 border border-gray-300 rounded-md"
                      >
                        <option value="minimize_cost">Minimize Cost</option>
                        <option value="minimize_duration">Minimize Duration</option>
                        <option value="balance_resources">Balance Resources</option>
                        <option value="maximize_utilization">Maximize Utilization</option>
                      </select>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Constraints</h4>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600 w-32">Max Budget:</label>
                          <input
                            type="number"
                            value={scenario.constraints.max_budget || ''}
                            onChange={e => {
                              const newScenarios = [...scenarios];
                              newScenarios[scenarioIndex].constraints.max_budget = e.target.value ? parseFloat(e.target.value) : undefined;
                              setScenarios(newScenarios);
                            }}
                            placeholder="No limit"
                            className="flex-1 p-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600 w-32">Max Duration:</label>
                          <input
                            type="number"
                            value={scenario.constraints.max_duration || ''}
                            onChange={e => {
                              const newScenarios = [...scenarios];
                              newScenarios[scenarioIndex].constraints.max_duration = e.target.value ? parseFloat(e.target.value) : undefined;
                              setScenarios(newScenarios);
                            }}
                            placeholder="No limit (hours)"
                            className="flex-1 p-2 border border-gray-300 rounded-md"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm text-gray-600 w-32">Target Util.:</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={scenario.constraints.resource_utilization_target || ''}
                            onChange={e => {
                              const newScenarios = [...scenarios];
                              newScenarios[scenarioIndex].constraints.resource_utilization_target = e.target.value ? parseFloat(e.target.value) : undefined;
                              setScenarios(newScenarios);
                            }}
                            placeholder="0.0 - 1.0"
                            className="flex-1 p-2 border border-gray-300 rounded-md"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Optimization Weights</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm text-gray-600">Cost Weight</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={scenario.weights.cost_weight}
                          onChange={e => {
                            const newScenarios = [...scenarios];
                            newScenarios[scenarioIndex].weights.cost_weight = parseFloat(e.target.value) || 0;
                            setScenarios(newScenarios);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Time Weight</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={scenario.weights.time_weight}
                          onChange={e => {
                            const newScenarios = [...scenarios];
                            newScenarios[scenarioIndex].weights.time_weight = parseFloat(e.target.value) || 0;
                            setScenarios(newScenarios);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Resource Weight</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={scenario.weights.resource_weight}
                          onChange={e => {
                            const newScenarios = [...scenarios];
                            newScenarios[scenarioIndex].weights.resource_weight = parseFloat(e.target.value) || 0;
                            setScenarios(newScenarios);
                          }}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Total: {(scenario.weights.cost_weight + scenario.weights.time_weight + scenario.weights.resource_weight).toFixed(1)} 
                      (should equal 1.0)
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Tab */}
      {activeTab === 'optimization' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Resource Optimization</h3>
            <p className="text-sm text-gray-600">Run different optimization algorithms and scenario analysis</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Algorithm Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Resource Algorithms</CardTitle>
                <CardDescription>Apply resource leveling and smoothing techniques</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={runResourceLeveling} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? 'Processing...' : 'Run Resource Leveling'}
                </Button>
                <p className="text-sm text-gray-600">
                  Delays non-critical tasks to resolve resource over-allocations while maintaining project duration.
                </p>

                <Button 
                  onClick={runResourceSmoothing} 
                  disabled={loading}
                  className="w-full"
                  variant="outline"
                >
                  {loading ? 'Processing...' : 'Run Resource Smoothing'}
                </Button>
                <p className="text-sm text-gray-600">
                  Reduces peak resource requirements by extending the project duration within float limits.
                </p>
              </CardContent>
            </Card>

            {/* Scenario Optimization */}
            <Card>
              <CardHeader>
                <CardTitle>Scenario Optimization</CardTitle>
                <CardDescription>Optimize based on different objectives and constraints</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {scenarios.map((scenario) => (
                    <div key={scenario.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">{scenario.name}</div>
                        <div className="text-sm text-gray-600 capitalize">
                          {scenario.objective.replace('_', ' ')}
                        </div>
                      </div>
                      <Button
                        onClick={() => runOptimization(scenario.name)}
                        disabled={loading}
                        size="sm"
                      >
                        {loading ? 'Running...' : 'Optimize'}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Current Project Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Project Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600">Total Tasks</div>
                  <div className="text-2xl font-bold text-blue-600">{tasks.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Resources</div>
                  <div className="text-2xl font-bold text-green-600">{resources.length}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Total Duration</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {tasks.reduce((sum, task) => sum + task.duration, 0)}h
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Estimated Cost</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(
                      tasks.reduce((sum, task) => {
                        return sum + task.required_resources.reduce((taskSum, req) => {
                          const resource = resources.find(r => r.id === req.resource_id);
                          return taskSum + (resource ? resource.cost_per_hour * task.duration * req.quantity : 0);
                        }, 0);
                      }, 0)
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Optimization Results</h3>

          {optimizationResults.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <h4 className="text-xl font-semibold text-gray-900 mb-2">No Optimization Results Yet</h4>
              <p className="text-gray-600 mb-6">Run optimization algorithms to see results and comparisons here</p>
              <Button onClick={() => setActiveTab('optimization')}>Go to Optimization</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Results Comparison */}
              <Card>
                <CardHeader>
                  <CardTitle>Scenario Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Scenario</th>
                          <th className="text-left p-2">Total Cost</th>
                          <th className="text-left p-2">Duration (hrs)</th>
                          <th className="text-left p-2">Avg. Utilization</th>
                          <th className="text-left p-2">Conflicts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizationResults.map((result) => {
                          const avgUtilization = Object.values(result.resource_utilization).reduce((a, b) => a + b, 0) / Object.keys(result.resource_utilization).length;
                          return (
                            <tr key={result.scenario_name} className="border-b">
                              <td className="p-2 font-medium">{result.scenario_name}</td>
                              <td className="p-2">{formatCurrency(result.total_cost)}</td>
                              <td className="p-2">{result.total_duration}</td>
                              <td className="p-2">{(avgUtilization * 100).toFixed(1)}%</td>
                              <td className="p-2">{result.resource_conflicts.length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Results for each scenario */}
              {optimizationResults.map((result) => (
                <Card key={result.scenario_name}>
                  <CardHeader>
                    <CardTitle>{result.scenario_name} - Detailed Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="text-sm text-blue-600">Total Cost</div>
                          <div className="text-2xl font-bold text-blue-900">{formatCurrency(result.total_cost)}</div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="text-sm text-green-600">Duration</div>
                          <div className="text-2xl font-bold text-green-900">{result.total_duration}h</div>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <div className="text-sm text-purple-600">Critical Path</div>
                          <div className="text-lg font-bold text-purple-900">{result.critical_path.length} tasks</div>
                        </div>
                        <div className="p-4 bg-orange-50 rounded-lg">
                          <div className="text-sm text-orange-600">Conflicts</div>
                          <div className="text-2xl font-bold text-orange-900">{result.resource_conflicts.length}</div>
                        </div>
                      </div>

                      {/* Resource Utilization */}
                      <div>
                        <h5 className="font-medium text-gray-900 mb-3">Resource Utilization</h5>
                        <div className="space-y-2">
                          {Object.entries(result.resource_utilization).map(([resourceId, utilization]) => {
                            const resource = resources.find(r => r.id === resourceId);
                            return (
                              <div key={resourceId} className="flex items-center space-x-4">
                                <div className="w-32 text-sm text-gray-600">{resource?.name || resourceId}</div>
                                <div className="flex-1 bg-gray-200 rounded-full h-4">
                                  <div 
                                    className={`h-4 rounded-full ${
                                      utilization > 0.9 ? 'bg-red-500' : 
                                      utilization > 0.7 ? 'bg-yellow-500' : 'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min(utilization * 100, 100)}%` }}
                                  />
                                </div>
                                <div className="w-16 text-sm text-gray-900">{(utilization * 100).toFixed(1)}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Resource Conflicts */}
                      {result.resource_conflicts.length > 0 && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-3">Resource Conflicts</h5>
                          <div className="space-y-3">
                            {result.resource_conflicts.map((conflict, index) => {
                              const resource = resources.find(r => r.id === conflict.resource_id);
                              return (
                                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="font-medium text-red-900">{resource?.name || conflict.resource_id}</div>
                                  <div className="text-sm text-red-700 mt-1">
                                    Over-allocated during {conflict.over_allocation_periods.length} periods
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    {conflict.over_allocation_periods.map((period, pIndex) => (
                                      <div key={pIndex} className="text-xs text-red-600">
                                        {period.start} to {period.end}: {period.excess} hours excess
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recommendations */}
                      {result.recommendations.length > 0 && (
                        <div>
                          <h5 className="font-medium text-gray-900 mb-3">Recommendations</h5>
                          <ul className="space-y-2">
                            {result.recommendations.map((rec, index) => (
                              <li key={index} className="flex items-start space-x-2">
                                <span className="text-blue-500 mt-1">•</span>
                                <span className="text-sm text-gray-700">{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
