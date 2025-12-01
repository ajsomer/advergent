import { GA4LandingPageMetric } from '@/hooks/useClientDetail';
import { ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, Fragment } from 'react';

interface GA4LandingPageTableProps {
    pages: GA4LandingPageMetric[];
}

type SortField = 'landingPage' | 'sessions' | 'engagementRate' | 'bounceRate' | 'conversions' | 'totalRevenue';
type SortDirection = 'asc' | 'desc';

export function GA4LandingPageTable({ pages }: GA4LandingPageTableProps) {
    const [sortField, setSortField] = useState<SortField>('sessions');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [expandedRow, setExpandedRow] = useState<number | null>(null);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const toggleRow = (index: number) => {
        setExpandedRow(expandedRow === index ? null : index);
    };

    const sortedPages = [...pages].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        const multiplier = sortDirection === 'asc' ? 1 : -1;

        if (typeof aVal === 'string') {
            return multiplier * aVal.localeCompare(bVal as string);
        }
        return multiplier * ((aVal as number) - (bVal as number));
    });

    return (
        <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                    <tr>
                        <th className="w-8"></th>
                        <th
                            className="text-left p-3 font-medium cursor-pointer hover:bg-slate-100"
                            onClick={() => handleSort('landingPage')}
                        >
                            <div className="flex items-center gap-2">
                                Landing Page
                                <ArrowUpDown className="h-4 w-4" />
                            </div>
                        </th>
                        <th
                            className="text-right p-3 font-medium cursor-pointer hover:bg-slate-100"
                            onClick={() => handleSort('sessions')}
                        >
                            <div className="flex items-center justify-end gap-2">
                                Sessions
                                <ArrowUpDown className="h-4 w-4" />
                            </div>
                        </th>
                        <th
                            className="text-right p-3 font-medium cursor-pointer hover:bg-slate-100"
                            onClick={() => handleSort('engagementRate')}
                        >
                            <div className="flex items-center justify-end gap-2">
                                Engagement Rate
                                <ArrowUpDown className="h-4 w-4" />
                            </div>
                        </th>
                        <th
                            className="text-right p-3 font-medium cursor-pointer hover:bg-slate-100"
                            onClick={() => handleSort('bounceRate')}
                        >
                            <div className="flex items-center justify-end gap-2">
                                Bounce Rate
                                <ArrowUpDown className="h-4 w-4" />
                            </div>
                        </th>
                        <th
                            className="text-right p-3 font-medium cursor-pointer hover:bg-slate-100"
                            onClick={() => handleSort('conversions')}
                        >
                            <div className="flex items-center justify-end gap-2">
                                Conversions
                                <ArrowUpDown className="h-4 w-4" />
                            </div>
                        </th>
                        <th
                            className="text-right p-3 font-medium cursor-pointer hover:bg-slate-100"
                            onClick={() => handleSort('totalRevenue')}
                        >
                            <div className="flex items-center justify-end gap-2">
                                Revenue
                                <ArrowUpDown className="h-4 w-4" />
                            </div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {sortedPages.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="text-center p-6 text-slate-500">
                                No landing page data available
                            </td>
                        </tr>
                    ) : (
                        sortedPages.map((page, index) => (
                            <Fragment key={`${page.landingPage}-${index}`}>
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
                                    <td className="p-3 font-medium max-w-md truncate" title={page.landingPage}>
                                        {page.landingPage}
                                    </td>
                                    <td className="p-3 text-right">{page.sessions.toLocaleString()}</td>
                                    <td className="p-3 text-right">{(page.engagementRate * 100).toFixed(1)}%</td>
                                    <td className="p-3 text-right">{(page.bounceRate * 100).toFixed(1)}%</td>
                                    <td className="p-3 text-right">{page.conversions.toFixed(1)}</td>
                                    <td className="p-3 text-right">${page.totalRevenue.toFixed(2)}</td>
                                </tr>
                                {expandedRow === index && (
                                    <tr className="bg-slate-50/50 border-b">
                                        <td colSpan={7} className="p-4">
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <h4 className="font-semibold mb-2 text-slate-700">Traffic Source</h4>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">Source:</span>
                                                            <span className="font-medium">{page.sessionSource}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">Medium:</span>
                                                            <span className="font-medium">{page.sessionMedium}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold mb-2 text-slate-700">Engagement Details</h4>
                                                    <div className="space-y-1">
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">Avg Session Duration:</span>
                                                            <span className="font-medium">{page.averageSessionDuration.toFixed(0)}s</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-slate-600">Latest Date:</span>
                                                            <span className="font-medium">{page.date}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-3 pt-3 border-t border-slate-200">
                                                <div className="grid grid-cols-4 gap-4 text-xs">
                                                    <div className="text-center">
                                                        <div className="text-slate-600 mb-1">Sessions</div>
                                                        <div className="text-lg font-semibold text-slate-900">{page.sessions.toLocaleString()}</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-slate-600 mb-1">Engagement</div>
                                                        <div className="text-lg font-semibold text-green-600">{(page.engagementRate * 100).toFixed(1)}%</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-slate-600 mb-1">Conversions</div>
                                                        <div className="text-lg font-semibold text-blue-600">{page.conversions.toFixed(1)}</div>
                                                    </div>
                                                    <div className="text-center">
                                                        <div className="text-slate-600 mb-1">Revenue</div>
                                                        <div className="text-lg font-semibold text-purple-600">${page.totalRevenue.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
