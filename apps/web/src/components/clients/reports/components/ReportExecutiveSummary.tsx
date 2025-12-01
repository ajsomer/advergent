import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';

interface ReportExecutiveSummaryProps {
  summary: string;
  keyHighlights: string[];
}

export function ReportExecutiveSummary({ summary, keyHighlights }: ReportExecutiveSummaryProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Lightbulb className="h-5 w-5" />
          Executive Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-slate-700 leading-relaxed mb-4">{summary}</p>

        {keyHighlights.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-semibold text-slate-600 mb-2">Key Highlights</h4>
            <ul className="space-y-2">
              {keyHighlights.map((highlight, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Badge variant="secondary" className="mt-0.5 shrink-0">
                    {index + 1}
                  </Badge>
                  <span className="text-sm text-slate-600">{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
