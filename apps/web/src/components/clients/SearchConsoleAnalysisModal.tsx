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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, Target, BarChart3, Zap } from 'lucide-react';

// Types for the new grouped analysis structure
interface QueryRecommendation {
    query: string;
    currentPosition: number;
    impressions: number;
    clicks: number;
    ctr: number;
    type: 'quick_win' | 'high_potential' | 'underperforming' | 'maintain';
    potentialImpact: 'high' | 'medium' | 'low';
    action: string;
    reasoning: string;
}

interface PageIssue {
    category: 'content' | 'ux' | 'engagement' | 'conversion' | 'seo';
    priority: 'high' | 'medium' | 'low';
    issue: string;
    action: string;
}

interface LandingPageAnalysis {
    page: string;
    pageScore: number;
    totalImpressions: number;
    totalClicks: number;
    ga4Metrics?: {
        sessions: number;
        engagementRate: number;
        bounceRate: number;
        conversions: number;
        revenue: number;
    };
    queryRecommendations: QueryRecommendation[];
    pageRecommendations: PageIssue[];
}

interface GroupedSearchConsoleAnalysis {
    summary: string;
    overallTrends: string[];
    landingPageAnalysis: LandingPageAnalysis[];
    topQuickWins: Array<{
        page: string;
        query: string;
        action: string;
        estimatedImpact: string;
    }>;
    strategicAdvice: string;
}

interface SearchConsoleAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    analysis: GroupedSearchConsoleAnalysis | null;
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
            case 'quick_win': return <Zap className="h-4 w-4 text-yellow-600" />;
            case 'high_potential': return <TrendingUp className="h-4 w-4 text-blue-600" />;
            case 'underperforming': return <TrendingDown className="h-4 w-4 text-red-600" />;
            case 'maintain': return <CheckCircle2 className="h-4 w-4 text-green-600" />;
            default: return <Target className="h-4 w-4 text-slate-600" />;
        }
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'content': return '📝';
            case 'ux': return '🎨';
            case 'engagement': return '💡';
            case 'conversion': return '🎯';
            case 'seo': return '🔍';
            default: return '📌';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-100';
        if (score >= 60) return 'text-yellow-600 bg-yellow-100';
        return 'text-red-600 bg-red-100';
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    // const formatType = (type: string) => {
    //   return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    // };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        Landing Page SEO Analysis
                    </DialogTitle>
                    <DialogDescription>
                        AI-powered insights grouped by landing page performance
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-slate-500 animate-pulse">Analyzing landing pages and queries...</p>
                    </div>
                ) : analysis ? (
                    <ScrollArea className="flex-1 pr-4">
                        <div className="space-y-6 py-4">
                            {/* Executive Summary */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                <h3 className="font-semibold text-slate-900 mb-2">Executive Summary</h3>
                                <p className="text-slate-700 leading-relaxed">{analysis.summary}</p>
                            </div>

                            {/* Overall Trends */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-blue-600" />
                                    Overall Trends
                                </h3>
                                <ul className="space-y-2">
                                    {analysis.overallTrends.map((trend, i) => (
                                        <li key={i} className="flex items-start gap-2 text-slate-700">
                                            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                                            {trend}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Top Quick Wins */}
                            {analysis.topQuickWins.length > 0 && (
                                <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                    <h3 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                                        <Zap className="h-4 w-4 text-amber-600" />
                                        Top Quick Wins
                                    </h3>
                                    <div className="space-y-3">
                                        {analysis.topQuickWins.map((win, i) => (
                                            <div key={i} className="bg-white p-3 rounded border border-amber-100">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="text-sm font-medium text-amber-900">
                                                        "{win.query}" on {new URL(win.page).pathname}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 mb-1">
                                                    <strong>Action:</strong> {win.action}
                                                </p>
                                                <p className="text-xs text-slate-600">
                                                    <strong>Impact:</strong> {win.estimatedImpact}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Landing Page Analysis */}
                            <div>
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Target className="h-4 w-4 text-purple-600" />
                                    Landing Page Analysis ({analysis.landingPageAnalysis.length} pages)
                                </h3>
                                <Accordion type="multiple" className="space-y-2">
                                    {analysis.landingPageAnalysis.map((pageAnalysis, index) => (
                                        <AccordionItem
                                            key={index}
                                            value={`page-${index}`}
                                            className="border rounded-lg bg-white"
                                        >
                                            <AccordionTrigger className="px-4 hover:no-underline">
                                                <div className="flex items-center justify-between w-full pr-4">
                                                    <div className="flex items-center gap-3">
                                                        <Badge className={`${getScoreColor(pageAnalysis.pageScore)} border`}>
                                                            {pageAnalysis.pageScore}/100
                                                        </Badge>
                                                        <span className="text-sm font-medium text-left line-clamp-1">
                                                            {new URL(pageAnalysis.page).pathname || '/'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-slate-500">
                                                        <span>{pageAnalysis.totalClicks} clicks</span>
                                                        <span>{pageAnalysis.totalImpressions} impr</span>
                                                        {pageAnalysis.ga4Metrics && (
                                                            <span className="text-blue-600">
                                                                {(pageAnalysis.ga4Metrics.engagementRate * 100).toFixed(0)}% engaged
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="px-4 pb-4">
                                                <div className="space-y-4 pt-2">
                                                    {/* GA4 Metrics */}
                                                    {pageAnalysis.ga4Metrics && (
                                                        <div className="grid grid-cols-5 gap-3 bg-slate-50 p-3 rounded">
                                                            <div className="text-center">
                                                                <div className="text-xs text-slate-600">Sessions</div>
                                                                <div className="text-sm font-semibold">{pageAnalysis.ga4Metrics.sessions}</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-xs text-slate-600">Engagement</div>
                                                                <div className="text-sm font-semibold">
                                                                    {(pageAnalysis.ga4Metrics.engagementRate * 100).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-xs text-slate-600">Bounce</div>
                                                                <div className="text-sm font-semibold">
                                                                    {(pageAnalysis.ga4Metrics.bounceRate * 100).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-xs text-slate-600">Conversions</div>
                                                                <div className="text-sm font-semibold">{pageAnalysis.ga4Metrics.conversions.toFixed(0)}</div>
                                                            </div>
                                                            <div className="text-center">
                                                                <div className="text-xs text-slate-600">Revenue</div>
                                                                <div className="text-sm font-semibold">${pageAnalysis.ga4Metrics.revenue.toFixed(0)}</div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Query Recommendations */}
                                                    {pageAnalysis.queryRecommendations.length > 0 && (
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-800 mb-2">
                                                                Query Recommendations ({pageAnalysis.queryRecommendations.length})
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {pageAnalysis.queryRecommendations.map((query, qIndex) => (
                                                                    <div key={qIndex} className="border rounded p-3 hover:bg-slate-50 transition-colors">
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex items-center gap-2 flex-1">
                                                                                {getTypeIcon(query.type)}
                                                                                <span className="font-medium text-sm">"{query.query}"</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <Badge variant="outline" className={getImpactColor(query.potentialImpact)}>
                                                                                    {query.potentialImpact} impact
                                                                                </Badge>
                                                                                <Badge variant="secondary" className="text-xs">
                                                                                    Pos {query.currentPosition.toFixed(1)}
                                                                                </Badge>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xs text-slate-600 mb-1">
                                                                            {query.clicks} clicks • {query.impressions} impr • {(query.ctr * 100).toFixed(2)}% CTR
                                                                        </div>
                                                                        <p className="text-sm text-slate-700">
                                                                            <span className="font-medium">Action:</span> {query.action}
                                                                        </p>
                                                                        <p className="text-xs text-slate-600 mt-1 italic">
                                                                            {query.reasoning}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Page-Level Issues */}
                                                    {pageAnalysis.pageRecommendations.length > 0 && (
                                                        <div>
                                                            <h4 className="text-sm font-semibold text-slate-800 mb-2">
                                                                Page-Level Recommendations ({pageAnalysis.pageRecommendations.length})
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {pageAnalysis.pageRecommendations.map((issue, iIndex) => (
                                                                    <div key={iIndex} className="border rounded p-3 bg-slate-50">
                                                                        <div className="flex items-start justify-between mb-1">
                                                                            <div className="flex items-center gap-2">
                                                                                <span>{getCategoryIcon(issue.category)}</span>
                                                                                <span className="text-xs font-medium text-slate-700 uppercase">
                                                                                    {issue.category}
                                                                                </span>
                                                                            </div>
                                                                            <Badge variant="outline" className={getPriorityColor(issue.priority) + ' text-xs'}>
                                                                                {issue.priority} priority
                                                                            </Badge>
                                                                        </div>
                                                                        <p className="text-sm text-slate-800 font-medium mb-1">{issue.issue}</p>
                                                                        <p className="text-sm text-slate-600">→ {issue.action}</p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </div>

                            {/* Strategic Advice */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <h3 className="font-semibold text-blue-900 mb-2">Strategic Advice</h3>
                                <p className="text-blue-800 leading-relaxed">{analysis.strategicAdvice}</p>
                            </div>
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
