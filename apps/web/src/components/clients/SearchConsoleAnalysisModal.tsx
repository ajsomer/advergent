import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, TrendingUp, TrendingDown, Lightbulb, CheckCircle2 } from 'lucide-react';

interface SearchConsoleAnalysis {
    summary: string;
    key_trends: string[];
    opportunities: {
        query: string;
        type: 'quick_win' | 'high_potential' | 'underperforming';
        potential_impact: 'high' | 'medium' | 'low';
        action: string;
    }[];
    strategic_advice: string;
    content_analysis?: {
        score: number;
        gaps: string[];
        suggestions: string[];
    };
}

interface SearchConsoleAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysis: SearchConsoleAnalysis | null;
    isLoading: boolean;
}

export function SearchConsoleAnalysisModal({
    isOpen,
    onClose,
    analysis,
    isLoading,
}: SearchConsoleAnalysisModalProps) {
    const getImpactColor = (impact: string) => {
        switch (impact) {
            case 'high': return 'text-green-600 bg-green-50 border-green-200';
            case 'medium': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'low': return 'text-slate-600 bg-slate-50 border-slate-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'quick_win': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
            case 'high_potential': return <TrendingUp className="h-4 w-4 text-blue-600" />;
            case 'underperforming': return <TrendingDown className="h-4 w-4 text-red-600" />;
            default: return <Lightbulb className="h-4 w-4 text-yellow-600" />;
        }
    };

    const formatType = (type: string) => {
        return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        AI Search Analysis
                    </DialogTitle>
                    <DialogDescription>
                        Strategic insights based on your recent Search Console performance data.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-slate-500 animate-pulse">Analyzing search patterns...</p>
                    </div>
                ) : analysis ? (
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-6 py-4">
                            {/* Executive Summary */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h3 className="font-semibold text-slate-900 mb-2">Executive Summary</h3>
                                <p className="text-slate-700 leading-relaxed">{analysis.summary}</p>
                            </div>

                            {/* Key Trends */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-blue-600" />
                                    Key Trends
                                </h3>
                                <ul className="space-y-2">
                                    {analysis.key_trends.map((trend, i) => (
                                        <li key={i} className="flex items-start gap-2 text-slate-700">
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                            {trend}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Opportunities */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-yellow-600" />
                                    Opportunities & Actions
                                </h3>
                                <div className="grid gap-4">
                                    {analysis.opportunities.map((opp, i) => (
                                        <div key={i} className="border rounded-lg p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    {getTypeIcon(opp.type)}
                                                    <span className="font-medium text-slate-900">"{opp.query}"</span>
                                                </div>
                                                <Badge variant="outline" className={getImpactColor(opp.potential_impact)}>
                                                    {opp.potential_impact.toUpperCase()} IMPACT
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                                                <Badge variant="secondary" className="text-xs font-normal">
                                                    {formatType(opp.type)}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-slate-600">
                                                <span className="font-medium text-slate-700">Action: </span>
                                                {opp.action}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Strategic Advice */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h3 className="font-semibold text-blue-900 mb-2">Strategic Advice</h3>
                                <p className="text-blue-800 leading-relaxed">{analysis.strategic_advice}</p>
                            </div>

                            {/* Content Analysis */}
                            {analysis.content_analysis && (
                                <div className="border rounded-lg p-4 bg-white shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            Landing Page Analysis
                                        </h3>
                                        <Badge variant={analysis.content_analysis.score >= 70 ? 'default' : 'destructive'}>
                                            Score: {analysis.content_analysis.score}/100
                                        </Badge>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-700 mb-2">Content Gaps</h4>
                                            <ul className="space-y-1">
                                                {analysis.content_analysis.gaps.map((gap, i) => (
                                                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                                        <span className="text-red-500">•</span>
                                                        {gap}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-medium text-slate-700 mb-2">Suggestions</h4>
                                            <ul className="space-y-1">
                                                {analysis.content_analysis.suggestions.map((suggestion, i) => (
                                                    <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                                        <span className="text-green-500">•</span>
                                                        {suggestion}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="py-12 text-center text-slate-500">
                        <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                        <p>Unable to load analysis. Please try again.</p>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t mt-auto">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
