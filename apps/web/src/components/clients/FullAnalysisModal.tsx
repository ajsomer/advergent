import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, CheckCircle2, TrendingDown } from 'lucide-react';

interface AnalysisResult {
    success: boolean;
    clientId: string;
    analyzedQueries: number;
    recommendationsCreated: number;
    estimatedTotalSavings: number;
    processingTime: number;
    message?: string;
}

interface FullAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRunAnalysis: () => Promise<AnalysisResult>;
}

export function FullAnalysisModal({
    isOpen,
    onClose,
    onRunAnalysis,
}: FullAnalysisModalProps) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleRunAnalysis = async () => {
        setIsAnalyzing(true);
        setError(null);
        setResult(null);

        try {
            const analysisResult = await onRunAnalysis();
            setResult(analysisResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to run analysis');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleClose = () => {
        setResult(null);
        setError(null);
        setIsAnalyzing(false);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        AI-Powered Analysis
                    </DialogTitle>
                    <DialogDescription>
                        Analyze all query overlaps with GA4 engagement data to optimize ad spend
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {!isAnalyzing && !result && !error && (
                        <div className="text-center py-8">
                            <p className="text-slate-600 mb-4">
                                This will analyze your Google Ads spend against Search Console rankings
                                and GA4 landing page performance to identify optimization opportunities.
                            </p>
                            <Button onClick={handleRunAnalysis} className="gap-2">
                                <Sparkles className="h-4 w-4" />
                                Start Analysis
                            </Button>
                        </div>
                    )}

                    {isAnalyzing && (
                        <div className="text-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-purple-600" />
                            <p className="text-slate-600 font-medium">Analyzing queries...</p>
                            <p className="text-sm text-slate-500 mt-2">
                                This may take a few moments
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-800 font-medium">Analysis Failed</p>
                            <p className="text-red-600 text-sm mt-1">{error}</p>
                            <Button
                                onClick={handleRunAnalysis}
                                variant="outline"
                                className="mt-3"
                                size="sm"
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-green-800 font-medium">Analysis Complete!</p>
                                    <p className="text-green-700 text-sm mt-1">
                                        {result.message || 'Successfully analyzed your query overlaps'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <p className="text-slate-600 text-sm mb-1">Queries Analyzed</p>
                                    <p className="text-2xl font-bold text-slate-900">
                                        {result.analyzedQueries.toLocaleString()}
                                    </p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <p className="text-slate-600 text-sm mb-1">Recommendations</p>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {result.recommendationsCreated.toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-purple-900 font-medium flex items-center gap-2">
                                            <TrendingDown className="h-4 w-4" />
                                            Estimated Monthly Savings
                                        </p>
                                        <p className="text-purple-700 text-sm mt-1">
                                            Based on identified optimization opportunities
                                        </p>
                                    </div>
                                    <p className="text-3xl font-bold text-purple-600">
                                        ${result.estimatedTotalSavings.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <p className="text-sm text-slate-500">
                                    Processing time: {(result.processingTime / 1000).toFixed(1)}s
                                </p>
                                <Button onClick={handleClose} variant="default">
                                    View Recommendations
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
