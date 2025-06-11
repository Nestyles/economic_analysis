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

interface ProjectDetails {
  id: number;
  name: string;
  description?: string;
  estimates?: any;
  attributes?: any;
}

interface EstimationInputs {
  sizeKloc: string;
  mode: string;
  ufp: string;
  caf: string;
  expertEstimates: string;
  regressionSize: string;
}

interface ProjectEstimationProps {
  projectId: number;
  onBack: () => void;
}

export default function ProjectEstimation({ projectId, onBack }: ProjectEstimationProps) {
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [estimating, setEstimating] = useState(false)
  const [inputs, setInputs] = useState<EstimationInputs>({
    sizeKloc: '',
    mode: 'organic',
    ufp: '',
    caf: '1.0',
    expertEstimates: '',
    regressionSize: ''
  })

  useEffect(() => {
    fetchProject()
  }, [projectId])

  const fetchProject = async () => {
    try {
      const token = getAuthToken()
      const response = await fetch(`http://localhost:8000/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setProject(data)
        
        // Pre-populate inputs if project has existing attributes
        if (data.attributes) {
          setInputs({
            sizeKloc: data.attributes.size_kloc?.toString() || '',
            mode: data.attributes.mode || 'organic',
            ufp: data.attributes.ufp?.toString() || '',
            caf: data.attributes.caf?.toString() || '1.0',
            expertEstimates: data.attributes.expert_estimates?.join(', ') || '',
            regressionSize: data.attributes.regression_size?.toString() || ''
          })
        }
      } else {
        console.error('Failed to fetch project')
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEstimate = async () => {
    setEstimating(true)
    
    try {
      const token = getAuthToken()
      
      // Prepare estimation input
      const estimationInput: any = {}
      
      if (inputs.sizeKloc && inputs.mode) {
        estimationInput.size_kloc = parseFloat(inputs.sizeKloc)
        estimationInput.mode = inputs.mode
      }
      
      if (inputs.ufp && inputs.caf) {
        estimationInput.ufp = parseInt(inputs.ufp)
        estimationInput.caf = parseFloat(inputs.caf)
      }
      
      if (inputs.expertEstimates.trim()) {
        const estimates = inputs.expertEstimates
          .split(',')
          .map(s => parseFloat(s.trim()))
          .filter(n => !isNaN(n) && n > 0)
        
        if (estimates.length > 0) {
          estimationInput.expert_estimates = estimates
        }
      }
      
      if (inputs.regressionSize) {
        estimationInput.regression_size = parseFloat(inputs.regressionSize)
      }
      
      const response = await fetch(`http://localhost:8000/projects/${projectId}/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(estimationInput)
      })
      
      if (response.ok) {
        const data = await response.json()
        // Refresh project data to show new estimates
        fetchProject()
      } else {
        console.error('Failed to estimate project cost')
      }
    } catch (error) {
      console.error('Error estimating cost:', error)
    } finally {
      setEstimating(false)
    }
  }

  const handleInputChange = (field: keyof EstimationInputs, value: string) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const formatResult = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A'
    return `${value.toFixed(2)} person-months`
  }

  const formatCurrency = (amount?: number) => {
    if (amount === null || amount === undefined) return 'N/A'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount * 10000) // Assuming person-months * $10k average rate
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading project...</span>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Project Not Found</h3>
        <Button onClick={onBack}>Back to Projects</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{project.name}</h2>
          <p className="text-gray-600 mt-2">{project.description || 'No description provided'}</p>
        </div>
        <Button variant="outline" onClick={onBack}>
          ← Back to Projects
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Panel */}
        <div className="space-y-6">
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
            </CardContent>
          </Card>

          <Button 
            onClick={handleEstimate} 
            className="w-full" 
            size="lg"
            disabled={estimating}
          >
            {estimating ? 'Calculating...' : 'Calculate Estimates'}
          </Button>
        </div>

        {/* Results Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>📋 Estimation Results</CardTitle>
              <CardDescription>
                Cost estimates for {project.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.estimates ? (
                <div className="space-y-3">
                  {project.estimates.cocomo && (
                    <div className="flex justify-between p-3 bg-blue-50 rounded">
                      <span className="font-medium">COCOMO Basic:</span>
                      <span className="text-blue-600 font-semibold">
                        {formatResult(project.estimates.cocomo.effort_person_months)}
                      </span>
                    </div>
                  )}
                  
                  {project.estimates.function_points && (
                    <div className="flex justify-between p-3 bg-green-50 rounded">
                      <span className="font-medium">Function Points:</span>
                      <span className="text-green-600 font-semibold">
                        {formatResult(project.estimates.function_points.estimates?.average_productivity?.person_months)}
                      </span>
                    </div>
                  )}
                  
                  {project.estimates.expert_judgment && (
                    <div className="flex justify-between p-3 bg-purple-50 rounded">
                      <span className="font-medium">Expert Judgment:</span>
                      <span className="text-purple-600 font-semibold">
                        {formatResult(project.estimates.expert_judgment.mean)}
                      </span>
                    </div>
                  )}
                  
                  {project.estimates.delphi && (
                    <div className="flex justify-between p-3 bg-orange-50 rounded">
                      <span className="font-medium">Delphi Method:</span>
                      <span className="text-orange-600 font-semibold">
                        {formatResult(project.estimates.delphi.final_estimate)}
                      </span>
                    </div>
                  )}
                  
                  {project.estimates.regression && (
                    <div className="flex justify-between p-3 bg-red-50 rounded">
                      <span className="font-medium">Regression Analysis:</span>
                      <span className="text-red-600 font-semibold">
                        {formatResult(project.estimates.regression.estimated_effort)}
                      </span>
                    </div>
                  )}

                  {/* Calculate and show average */}
                  {(() => {
                    const estimates = []
                    if (project.estimates.cocomo?.effort_person_months) estimates.push(project.estimates.cocomo.effort_person_months)
                    if (project.estimates.function_points?.estimates?.average_productivity?.person_months) estimates.push(project.estimates.function_points.estimates.average_productivity.person_months)
                    if (project.estimates.expert_judgment?.mean) estimates.push(project.estimates.expert_judgment.mean)
                    if (project.estimates.delphi?.final_estimate) estimates.push(project.estimates.delphi.final_estimate)
                    if (project.estimates.regression?.estimated_effort) estimates.push(project.estimates.regression.estimated_effort)
                    
                    if (estimates.length > 0) {
                      const average = estimates.reduce((a, b) => a + b, 0) / estimates.length
                      return (
                        <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                          <h4 className="font-semibold text-gray-900 mb-2">Summary</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Valid Estimates:</span>
                              <span className="font-medium">{estimates.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average Estimate:</span>
                              <span className="font-bold text-gray-900">{average.toFixed(2)} person-months</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Estimated Cost:</span>
                              <span className="font-bold text-gray-900">{formatCurrency(average)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No estimates available. Use the form on the left to calculate cost estimates.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detailed Results */}
          {project.estimates && (
            <Card>
              <CardHeader>
                <CardTitle>📊 Detailed Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.estimates.cocomo && (
                  <div className="p-3 border rounded">
                    <h4 className="font-medium mb-2">COCOMO Details</h4>
                    <div className="text-sm space-y-1">
                      <div>Development Time: {project.estimates.cocomo.development_time_months?.toFixed(1)} months</div>
                      <div>Average Team Size: {project.estimates.cocomo.average_team_size} people</div>
                      <div>Mode: {project.estimates.cocomo.mode_description}</div>
                    </div>
                  </div>
                )}
                
                {project.estimates.expert_judgment && (
                  <div className="p-3 border rounded">
                    <h4 className="font-medium mb-2">Expert Judgment Analysis</h4>
                    <div className="text-sm space-y-1">
                      <div>Median: {project.estimates.expert_judgment.median} person-months</div>
                      <div>Std Deviation: {project.estimates.expert_judgment.standard_deviation}</div>
                      <div>95% Confidence: [{project.estimates.expert_judgment.confidence_interval_95?.join(', ')}]</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
