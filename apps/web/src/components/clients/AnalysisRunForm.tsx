import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import type { AnalysisConfig, AnalysisResult } from '@/hooks/useClientDetail';

interface AnalysisRunFormProps {
  clientId: string;
  onAnalysisComplete: (results: AnalysisResult) => void;
  isRunning: boolean;
  onRun: (config: AnalysisConfig) => void;
}

export function AnalysisRunForm({
  clientId,
  onAnalysisComplete,
  isRunning,
  onRun,
}: AnalysisRunFormProps) {
  const [config, setConfig] = useState<AnalysisConfig>({
    minSpend: 10,
    maxQueries: 50,
    batchSize: 5,
    delayMs: 1000,
  });

  const [results, setResults] = useState<AnalysisResult | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResults(null);
    onRun(config);
  };

  const handleResultsUpdate = (newResults: AnalysisResult) => {
    setResults(newResults);
    onAnalysisComplete(newResults);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Run New Analysis</CardTitle>
          <CardDescription>
            Configure and trigger AI analysis to generate recommendations for query overlaps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minSpend">Min Spend Threshold ($)</Label>
                <Input
                  id="minSpend"
                  type="number"
                  min="0"
                  step="0.01"
                  value={config.minSpend || ''}
                  onChange={(e) =>
                    setConfig({ ...config, minSpend: parseFloat(e.target.value) || 0 })
                  }
                  disabled={isRunning}
                />
                <p className="text-xs text-slate-500">
                  Only analyze queries with at least this much spend
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxQueries">Max Queries to Analyze</Label>
                <Input
                  id="maxQueries"
                  type="number"
                  min="1"
                  max="100"
                  value={config.maxQueries || ''}
                  onChange={(e) =>
                    setConfig({ ...config, maxQueries: parseInt(e.target.value) || 50 })
                  }
                  disabled={isRunning}
                />
                <p className="text-xs text-slate-500">
                  Limit analysis to top N queries by spend
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min="1"
                  max="10"
                  value={config.batchSize || ''}
                  onChange={(e) =>
                    setConfig({ ...config, batchSize: parseInt(e.target.value) || 5 })
                  }
                  disabled={isRunning}
                />
                <p className="text-xs text-slate-500">
                  Number of queries to analyze in parallel
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delayMs">Delay Between Batches (ms)</Label>
                <Input
                  id="delayMs"
                  type="number"
                  min="0"
                  step="100"
                  value={config.delayMs || ''}
                  onChange={(e) =>
                    setConfig({ ...config, delayMs: parseInt(e.target.value) || 1000 })
                  }
                  disabled={isRunning}
                />
                <p className="text-xs text-slate-500">
                  Delay between batches to respect rate limits
                </p>
              </div>
            </div>

            <Button type="submit" disabled={isRunning} className="w-full">
              {isRunning ? 'Running Analysis...' : 'Run Analysis'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isRunning && (
        <Alert>
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900 mr-3"></div>
            <div>
              <p className="font-medium">Analysis in progress...</p>
              <p className="text-sm text-slate-600 mt-1">
                This may take a few minutes depending on the number of queries
              </p>
            </div>
          </div>
        </Alert>
      )}

      {results && !isRunning && (
        <Alert variant="success">
          <div>
            <p className="font-medium">Analysis Complete!</p>
            <div className="mt-2 space-y-1 text-sm">
              <p>Analyzed {results.analyzedQueries} queries</p>
              <p>Created {results.recommendationsCreated} recommendations</p>
              <p className="font-semibold text-green-600">
                Estimated Total Savings: ${results.estimatedTotalSavings.toFixed(2)}/month
              </p>
              <p className="text-slate-500">
                Processing time: {(results.processingTime / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        </Alert>
      )}
    </div>
  );
}
