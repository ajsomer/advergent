import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { ReportTrigger, InterplayReportDateRange } from '@advergent/shared';

interface ReportHeaderProps {
  title: string;
  generatedAt: string;
  dateRange: InterplayReportDateRange;
  trigger: ReportTrigger;
}

const triggerLabels: Record<ReportTrigger, string> = {
  client_creation: 'Auto-Generated',
  manual: 'Manual Regeneration',
  scheduled: 'Scheduled Run',
};

const triggerVariants: Record<ReportTrigger, 'default' | 'secondary' | 'outline'> = {
  client_creation: 'outline',
  manual: 'secondary',
  scheduled: 'default',
};

export function ReportHeader({ title, generatedAt, dateRange, trigger }: ReportHeaderProps) {
  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM d, yyyy');
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Analyzing {formatDate(dateRange.start)} - {formatDate(dateRange.end)} ({dateRange.days} days)
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm text-slate-500">
          Generated {formatDate(generatedAt)}
        </p>
        <Badge variant={triggerVariants[trigger]} className="mt-1">
          {triggerLabels[trigger]}
        </Badge>
      </div>
    </div>
  );
}
