'use client'

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAuthToken } from "@/lib/auth"

interface EstimationResults {
  cocomo: number | null;
  functionPoints: number | null;
  expertJudgment: number | null;
  delphi: number | null;
  regression: number | null;
}

interface DetailedResults {
  project_name?: string;
  estimation_methods?: {
    cocomo?: any;
    function_points?: any;
    expert_judgment?: any;
    delphi?: any;
    regression?: any;
  };
  summary?: {
    methods_used?: number;
    estimates?: number[];
    average_estimate?: number;
    min_estimate?: number;
    max_estimate?: number;
    estimate_range?: number;
  };
}

interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface ProjectInputs {
  // COCOMO inputs
  sizeKloc: string;
  mode: string;
  
  // Function Points inputs
  ufp: string;
  caf: string;
  
  // Expert Judgment inputs
  expertEstimates: string;
  
  // Regression inputs
  regressionSize: string;
}

export default function CostEstimationModule() {
  const [inputs, setInputs] = useState<ProjectInputs>({
    sizeKloc: '',
    mode: 'organic',
    ufp: '',
    caf: '1.0',
    expertEstimates: '',
    regressionSize: ''
  });
  const [results, setResults] = useState<EstimationResults>({
    cocomo: null,
    functionPoints: null,
    expertJudgment: null,
    delphi: null,
    regression: null
  });

  const [detailedResults, setDetailedResults] = useState<DetailedResults>({});
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);

  // Project selection state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [savingToProject, setSavingToProject] = useState(false);

  // Fetch user projects on component mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setLoadingProjects(false);
        return;
      }

      const response = await fetch('http://localhost:8000/projects/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      } else {
        console.error('Failed to fetch projects');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const saveToProject = async () => {
    if (!selectedProjectId) {
      alert('Please select a project to save the estimation to');
      return;
    }

    if (Object.values(results).every(result => result === null)) {
      alert('Please calculate estimations before saving to project');
      return;
    }

    setSavingToProject(true);
    try {
      const token = getAuthToken();
      const estimationInput = {
        size_kloc: inputs.sizeKloc ? parseFloat(inputs.sizeKloc) : null,
        mode: inputs.mode || null,
        ufp: inputs.ufp ? parseInt(inputs.ufp) : null,
        caf: inputs.caf ? parseFloat(inputs.caf) : null,
        expert_estimates: inputs.expertEstimates.trim() 
          ? inputs.expertEstimates.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0)
          : null,
        regression_size: inputs.regressionSize ? parseFloat(inputs.regressionSize) : null
      };

      const response = await fetch(`http://localhost:8000/projects/${selectedProjectId}/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(estimationInput)
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Estimation saved to project successfully!`);
        console.log('Save response:', data);
      } else {
        const errorData = await response.json();
        alert(`Failed to save estimation: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving to project:', error);
      alert('Error saving estimation to project');
    } finally {
      setSavingToProject(false);
    }
  };

  // COCOMO Basic Model Implementation
  const calculateCOCOMO = (sizeKloc: number, mode: string): number => {
    const modes: { [key: string]: { a: number; b: number } } = {
      'organic': { a: 2.4, b: 1.05 },
      'semi-detached': { a: 3.0, b: 1.12 },
      'embedded': { a: 3.6, b: 1.20 }
    };
    
    const coefficients = modes[mode];
    if (!coefficients) throw new Error('Invalid mode');
    
    return coefficients.a * Math.pow(sizeKloc, coefficients.b);
  };

  // Function Points Implementation
  const calculateFunctionPoints = (ufp: number, caf: number): number => {
    // Adjusted Function Points = UFP × CAF
    // Cost estimation using industry average (e.g., 8-20 hours per function point)
    const hoursPerFP = 14; // Average hours per function point
    const adjustedFP = ufp * caf;
    return adjustedFP * hoursPerFP;
  };

  // Expert Judgment Implementation
  const calculateExpertJudgment = (estimates: number[]): number => {
    if (estimates.length === 0) return 0;
    // Simple average of expert estimates
    const sum = estimates.reduce((acc, val) => acc + val, 0);
    return sum / estimates.length;
  };

  // Delphi Method Implementation
  const calculateDelphi = (estimates: number[]): number => {
    if (estimates.length === 0) return 0;
    
    // Sort estimates
    const sorted = [...estimates].sort((a, b) => a - b);
    
    // Remove extreme outliers (top and bottom 10%)
    const removeCount = Math.floor(sorted.length * 0.1);
    const trimmed = sorted.slice(removeCount, sorted.length - removeCount);
    
    // Calculate weighted average (giving more weight to middle estimates)
    if (trimmed.length === 0) return calculateExpertJudgment(estimates);
    
    const sum = trimmed.reduce((acc, val) => acc + val, 0);
    return sum / trimmed.length;
  };

  // Regression Analysis Implementation
  const calculateRegression = (size: number): number => {
    // Simple linear regression model: Effort = a + b * Size
    // These coefficients would typically be derived from historical data
    const a = 1.2; // Intercept
    const b = 0.35; // Slope (effort per unit size)
    
    return a + (b * size);
  };
  const handleCalculate = async () => {
    setLoading(true);
    
    try {
      const newResults: EstimationResults = {
        cocomo: null,
        functionPoints: null,
        expertJudgment: null,
        delphi: null,
        regression: null
      };

      // Check if we have access token for API calls
      const token = localStorage.getItem('access_token');
      const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

      // If we have a token, try to use the backend API
      if (token) {
        try {
          // Prepare comprehensive estimation input
          const estimationInput = {
            project_name: "Current Project",
            size_kloc: inputs.sizeKloc ? parseFloat(inputs.sizeKloc) : null,
            mode: inputs.mode || null,
            ufp: inputs.ufp ? parseInt(inputs.ufp) : null,
            caf: inputs.caf ? parseFloat(inputs.caf) : null,
            expert_estimates: inputs.expertEstimates.trim() 
              ? inputs.expertEstimates.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n) && n > 0)
              : null,
            regression_size: inputs.regressionSize ? parseFloat(inputs.regressionSize) : null
          };

          const response = await fetch(`${baseURL}/cost_estimation/comprehensive`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(estimationInput)
          });          if (response.ok) {
            const data = await response.json();
            const methods = data.estimation_methods;

            // Store detailed results for advanced view
            setDetailedResults(data);

            // Extract results from API response
            if (methods.cocomo && !methods.cocomo.error) {
              newResults.cocomo = methods.cocomo.effort_person_months;
            }
            
            if (methods.function_points && !methods.function_points.error) {
              newResults.functionPoints = methods.function_points.estimates?.average_productivity?.person_months || null;
            }
            
            if (methods.expert_judgment && !methods.expert_judgment.error) {
              newResults.expertJudgment = methods.expert_judgment.mean;
            }
            
            if (methods.delphi && !methods.delphi.error) {
              newResults.delphi = methods.delphi.final_estimate;
            }
            
            if (methods.regression && !methods.regression.error) {
              newResults.regression = methods.regression.estimated_effort;
            }

            setResults(newResults);
            setLoading(false);
            return; // Successfully used API
          }
        } catch (apiError) {
          console.warn('API call failed, falling back to client-side calculations:', apiError);
        }
      }

      // Fallback to client-side calculations
      // Calculate COCOMO if inputs are valid
      if (inputs.sizeKloc && inputs.mode) {
        const sizeKloc = parseFloat(inputs.sizeKloc);
        if (!isNaN(sizeKloc) && sizeKloc > 0) {
          newResults.cocomo = calculateCOCOMO(sizeKloc, inputs.mode);
        }
      }

      // Calculate Function Points if inputs are valid
      if (inputs.ufp && inputs.caf) {
        const ufp = parseInt(inputs.ufp);
        const caf = parseFloat(inputs.caf);
        if (!isNaN(ufp) && !isNaN(caf) && ufp > 0 && caf > 0) {
          newResults.functionPoints = calculateFunctionPoints(ufp, caf);
        }
      }

      // Calculate Expert Judgment if estimates are provided
      if (inputs.expertEstimates.trim()) {
        const estimates = inputs.expertEstimates
          .split(',')
          .map(s => parseFloat(s.trim()))
          .filter(n => !isNaN(n) && n > 0);
        
        if (estimates.length > 0) {
          newResults.expertJudgment = calculateExpertJudgment(estimates);
          newResults.delphi = calculateDelphi(estimates);
        }
      }

      // Calculate Regression if size is provided
      if (inputs.regressionSize) {
        const size = parseFloat(inputs.regressionSize);
        if (!isNaN(size) && size > 0) {
          newResults.regression = calculateRegression(size);
        }
      }

      setResults(newResults);
    } catch (error) {
      console.error('Error calculating estimates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof ProjectInputs, value: string) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatResult = (value: number | null): string => {
    if (value === null) return 'N/A';
    return `${value.toFixed(2)} person-months`;
  };

  const getValidResults = () => {
    return Object.entries(results).filter(([_, value]) => value !== null);
  };

  const calculateAverage = () => {
    const validResults = getValidResults();
    if (validResults.length === 0) return 0;
    
    const sum = validResults.reduce((acc, [_, value]) => acc + (value || 0), 0);
    return sum / validResults.length;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">💰 Cost Estimation Module</h2>
        <p className="text-gray-600">
          Compare multiple estimation techniques: COCOMO, Function Points, Expert Judgment, Delphi Method, and Regression Analysis
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-6">
          {/* COCOMO Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>🔢 COCOMO Model</CardTitle>
              <CardDescription>
                Basic COCOMO estimation based on project size and complexity mode
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sizeKloc">Project Size (KLOC)</Label>
                <Input
                  id="sizeKloc"
                  type="number"
                  placeholder="e.g., 10.5"
                  value={inputs.sizeKloc}
                  onChange={(e) => handleInputChange('sizeKloc', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mode">Project Mode</Label>
                <select
                  id="mode"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={inputs.mode}
                  onChange={(e) => handleInputChange('mode', e.target.value)}
                >
                  <option value="organic">Organic (Simple, small teams)</option>
                  <option value="semi-detached">Semi-detached (Medium complexity)</option>
                  <option value="embedded">Embedded (Complex, large teams)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Function Points Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>📊 Function Points</CardTitle>
              <CardDescription>
                Estimation based on functional requirements and complexity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ufp">Unadjusted Function Points (UFP)</Label>
                <Input
                  id="ufp"
                  type="number"
                  placeholder="e.g., 150"
                  value={inputs.ufp}
                  onChange={(e) => handleInputChange('ufp', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="caf">Complexity Adjustment Factor (0.65-1.35)</Label>
                <Input
                  id="caf"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 1.0"
                  value={inputs.caf}
                  onChange={(e) => handleInputChange('caf', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Expert Judgment/Delphi Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>👥 Expert Judgment & Delphi</CardTitle>
              <CardDescription>
                Multiple expert estimates for comparison and consensus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="expertEstimates">Expert Estimates (comma-separated, in person-months)</Label>
                <Input
                  id="expertEstimates"
                  placeholder="e.g., 12, 15, 18, 14, 16"
                  value={inputs.expertEstimates}
                  onChange={(e) => handleInputChange('expertEstimates', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Regression Inputs */}
          <Card>
            <CardHeader>
              <CardTitle>📈 Regression Analysis</CardTitle>
              <CardDescription>
                Mathematical model based on historical project data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="regressionSize">Project Size (any unit)</Label>
                <Input
                  id="regressionSize"
                  type="number"
                  placeholder="e.g., 50"
                  value={inputs.regressionSize}
                  onChange={(e) => handleInputChange('regressionSize', e.target.value)}
                />
              </div>
            </CardContent>          </Card>

          {/* Project Selection */}
          <Card>
            <CardHeader>
              <CardTitle>💾 Save to Project</CardTitle>
              <CardDescription>
                Save your cost estimation to a project for comparison and tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="projectSelect">Select Project</Label>
                {loadingProjects ? (
                  <div className="p-2 text-sm text-gray-500">Loading projects...</div>
                ) : projects.length === 0 ? (
                  <div className="p-2 text-sm text-gray-500">
                    No projects found. Create a project first in the Projects tab.
                  </div>
                ) : (
                  <select
                    id="projectSelect"
                    className="w-full p-2 border border-gray-300 rounded-md"
                    value={selectedProjectId || ''}
                    onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {selectedProjectId && (
                <Button 
                  onClick={saveToProject}
                  className="w-full"
                  variant="outline"
                  disabled={savingToProject || Object.values(results).every(result => result === null)}
                >
                  {savingToProject ? 'Saving...' : 'Save Estimation to Project'}
                </Button>
              )}
            </CardContent>
          </Card>

          <Button 
            onClick={handleCalculate} 
            className="w-full" 
            size="lg"
            disabled={loading}
          >
            {loading ? 'Calculating...' : 'Calculate Estimates'}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📋 Estimation Results</CardTitle>
              <CardDescription>
                Comparison of different estimation techniques
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-blue-50 rounded">
                  <span className="font-medium">COCOMO Basic:</span>
                  <span className="text-blue-600 font-semibold">{formatResult(results.cocomo)}</span>
                </div>
                
                <div className="flex justify-between p-3 bg-green-50 rounded">
                  <span className="font-medium">Function Points:</span>
                  <span className="text-green-600 font-semibold">{formatResult(results.functionPoints)}</span>
                </div>
                
                <div className="flex justify-between p-3 bg-purple-50 rounded">
                  <span className="font-medium">Expert Judgment:</span>
                  <span className="text-purple-600 font-semibold">{formatResult(results.expertJudgment)}</span>
                </div>
                
                <div className="flex justify-between p-3 bg-orange-50 rounded">
                  <span className="font-medium">Delphi Method:</span>
                  <span className="text-orange-600 font-semibold">{formatResult(results.delphi)}</span>
                </div>
                
                <div className="flex justify-between p-3 bg-red-50 rounded">
                  <span className="font-medium">Regression Analysis:</span>
                  <span className="text-red-600 font-semibold">{formatResult(results.regression)}</span>
                </div>
              </div>              {getValidResults().length > 0 && (
                <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-gray-900">Summary</h4>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowDetails(!showDetails)}
                    >
                      {showDetails ? 'Hide Details' : 'Show Details'}
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Valid Estimates:</span>
                      <span className="font-medium">{getValidResults().length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Estimate:</span>
                      <span className="font-bold text-gray-900">{calculateAverage().toFixed(2)} person-months</span>
                    </div>
                    {detailedResults.summary && (
                      <>
                        <div className="flex justify-between">
                          <span>Min Estimate:</span>
                          <span className="text-green-600">{detailedResults.summary.min_estimate?.toFixed(2)} person-months</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Estimate:</span>
                          <span className="text-red-600">{detailedResults.summary.max_estimate?.toFixed(2)} person-months</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Estimate Range:</span>
                          <span className="font-medium">{detailedResults.summary.estimate_range?.toFixed(2)} person-months</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Detailed Results Panel */}
              {showDetails && detailedResults.estimation_methods && (
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-gray-900">Detailed Analysis</h4>
                  
                  {/* COCOMO Details */}
                  {detailedResults.estimation_methods.cocomo && !detailedResults.estimation_methods.cocomo.error && (
                    <Card className="p-4 bg-blue-50">
                      <h5 className="font-medium text-blue-900 mb-2">COCOMO Analysis</h5>
                      <div className="text-sm space-y-1">
                        <div>Development Time: {detailedResults.estimation_methods.cocomo.development_time_months?.toFixed(1)} months</div>
                        <div>Average Team Size: {detailedResults.estimation_methods.cocomo.average_team_size} people</div>
                        <div>Mode: {detailedResults.estimation_methods.cocomo.mode_description}</div>
                      </div>
                    </Card>
                  )}

                  {/* Function Points Details */}
                  {detailedResults.estimation_methods.function_points && !detailedResults.estimation_methods.function_points.error && (
                    <Card className="p-4 bg-green-50">
                      <h5 className="font-medium text-green-900 mb-2">Function Points Analysis</h5>
                      <div className="text-sm space-y-1">
                        <div>Adjusted FP: {detailedResults.estimation_methods.function_points.adjusted_fp}</div>
                        <div>Low Productivity: {detailedResults.estimation_methods.function_points.estimates?.low_productivity?.person_months?.toFixed(2)} person-months</div>
                        <div>High Productivity: {detailedResults.estimation_methods.function_points.estimates?.high_productivity?.person_months?.toFixed(2)} person-months</div>
                      </div>
                    </Card>
                  )}

                  {/* Expert Judgment Details */}
                  {detailedResults.estimation_methods.expert_judgment && !detailedResults.estimation_methods.expert_judgment.error && (
                    <Card className="p-4 bg-purple-50">
                      <h5 className="font-medium text-purple-900 mb-2">Expert Judgment Analysis</h5>
                      <div className="text-sm space-y-1">
                        <div>Median: {detailedResults.estimation_methods.expert_judgment.median} person-months</div>
                        <div>Std Deviation: {detailedResults.estimation_methods.expert_judgment.standard_deviation}</div>
                        <div>95% Confidence: [{detailedResults.estimation_methods.expert_judgment.confidence_interval_95?.join(', ')}]</div>
                      </div>
                    </Card>
                  )}

                  {/* Delphi Details */}
                  {detailedResults.estimation_methods.delphi && !detailedResults.estimation_methods.delphi.error && (
                    <Card className="p-4 bg-orange-50">
                      <h5 className="font-medium text-orange-900 mb-2">Delphi Method Analysis</h5>
                      <div className="text-sm space-y-1">
                        <div>Consensus Level: {(detailedResults.estimation_methods.delphi.consensus_level * 100).toFixed(1)}%</div>
                        <div>Confidence: {detailedResults.estimation_methods.delphi.confidence}</div>
                        <div>Outliers Removed: {detailedResults.estimation_methods.delphi.rounds?.[0]?.removed_outliers || 0}</div>
                      </div>
                    </Card>
                  )}

                  {/* Regression Details */}
                  {detailedResults.estimation_methods.regression && !detailedResults.estimation_methods.regression.error && (
                    <Card className="p-4 bg-red-50">
                      <h5 className="font-medium text-red-900 mb-2">Regression Analysis</h5>
                      <div className="text-sm space-y-1">
                        <div>Equation: {detailedResults.estimation_methods.regression.equation}</div>
                        <div>R-squared: {detailedResults.estimation_methods.regression.r_squared}</div>
                        <div>Data Points: {detailedResults.estimation_methods.regression.data_points}</div>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Methodology Information */}
          <Card>
            <CardHeader>
              <CardTitle>ℹ️ Estimation Methods</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong>COCOMO:</strong> Uses project size (KLOC) and complexity mode to estimate effort using empirical formulas.
              </div>
              <div>
                <strong>Function Points:</strong> Estimates based on functional requirements adjusted for complexity.
              </div>
              <div>
                <strong>Expert Judgment:</strong> Simple average of multiple expert estimates.
              </div>
              <div>
                <strong>Delphi Method:</strong> Consensus-based approach that removes outliers from expert estimates.
              </div>
              <div>
                <strong>Regression:</strong> Mathematical model based on historical project data relationships.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
