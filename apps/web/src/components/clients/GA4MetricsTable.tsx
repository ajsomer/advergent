import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { GA4Metric } from '@/hooks/useClientDetail';

interface GA4MetricsTableProps {
    metrics: GA4Metric[];
}

export function GA4MetricsTable({ metrics }: GA4MetricsTableProps) {
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const toggleRow = (index: number) => {
        setExpandedRow(expandedRow === index ? null : index);
    };

    if (!metrics || metrics.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">No GA4 data available</p>
                <p className="text-sm text-slate-400 mt-2">
                    Connect GA4 in the onboarding flow to see analytics data
                </p>
            </div>
        );
    }

    return (
        <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                    <tr>
                        <th className="w-8"></th>
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-right p-3 font-medium">Sessions</th>
                        <th className="text-right p-3 font-medium">Engagement</th>
                        <th className="text-right p-3 font-medium">Conversions</th>
                        <th className="text-right p-3 font-medium">Revenue</th>
                    </tr>
                </thead>
                <tbody>
                    {metrics.map((metric, index) => (
                        <React.Fragment key={`${metric.date}-${index}`}>
                            <tr
                                className="border-b hover:bg-slate-50 cursor-pointer"
                                onClick={() => toggleRow(index)}
                            >
                                <td className="p-3 text-center">
                                    {expandedRow === index ? (
                                        <ChevronDown className="h-4 w-4 inline" />
                                    ) : (
                                        <ChevronRight className="h-4 w-4 inline" />
                                    )}
                                </td>
                                <td className="p-3 font-medium">
                                    {new Date(metric.date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                    })}
                                </td>
                                <td className="p-3 text-right">{metric.sessions.toLocaleString()}</td>
                                <td className="p-3 text-right">{(metric.engagementRate * 100).toFixed(1)}%</td>
                                <td className="p-3 text-right">{metric.conversions.toFixed(1)}</td>
                                <td className="p-3 text-right">${metric.totalRevenue.toFixed(2)}</td>
                            </tr>
                            {expandedRow === index && (
                                <tr className="bg-slate-50/50 border-b">
                                    <td colSpan={6} className="p-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <h4 className="font-semibold mb-2 text-slate-700 text-sm">User Behavior</h4>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Views per Session:</span>
                                                        <span className="font-medium">{metric.viewsPerSession.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Avg Session Duration:</span>
                                                        <span className="font-medium">{metric.averageSessionDuration.toFixed(0)}s</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Bounce Rate:</span>
                                                        <span className="font-medium">{(metric.bounceRate * 100).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold mb-2 text-slate-700 text-sm">Engagement</h4>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Sessions:</span>
                                                        <span className="font-medium">{metric.sessions.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Engagement Rate:</span>
                                                        <span className="font-medium text-green-600">{(metric.engagementRate * 100).toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold mb-2 text-slate-700 text-sm">Revenue</h4>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Conversions:</span>
                                                        <span className="font-medium text-blue-600">{metric.conversions.toFixed(1)}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-600">Total Revenue:</span>
                                                        <span className="font-medium text-purple-600">${metric.totalRevenue.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
