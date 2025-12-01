import { ReactNode } from 'react';

interface ReportPreviewContainerProps {
  children: ReactNode;
}

export function ReportPreviewContainer({ children }: ReportPreviewContainerProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
      <div className="max-h-[800px] overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
