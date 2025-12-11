import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';

export type BusinessType = 'ecommerce' | 'lead-gen' | 'saas' | 'local';

export interface BusinessTypeOption {
  value: BusinessType;
  label: string;
  description: string;
  isFullySupported: boolean;
  fallbackNote?: string;
}

interface BusinessTypeSelectorProps {
  value: BusinessType;
  onChange: (value: BusinessType) => void;
  options: BusinessTypeOption[];
  disabled?: boolean;
}

export function BusinessTypeSelector({
  value,
  onChange,
  options,
  disabled = false,
}: BusinessTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Business Type</Label>
      <p className="text-sm text-slate-500">
        Select the type of business for this client. This affects how recommendations are generated.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`
              relative flex flex-col items-start rounded-lg border-2 p-4 text-left transition-all
              ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-50'}
              ${value === option.value
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white'
              }
            `}
          >
            <div className="flex w-full items-center justify-between">
              <span className={`font-medium ${value === option.value ? 'text-blue-900' : 'text-slate-900'}`}>
                {option.label}
              </span>
              {!option.isFullySupported && (
                <Badge
                  variant="secondary"
                  className="text-xs"
                  title={option.fallbackNote}
                >
                  Beta
                </Badge>
              )}
            </div>
            <span className={`mt-1 text-sm ${value === option.value ? 'text-blue-700' : 'text-slate-500'}`}>
              {option.description}
            </span>
            {!option.isFullySupported && option.fallbackNote && (
              <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                <Info className="h-3 w-3" />
                <span>{option.fallbackNote}</span>
              </div>
            )}

            {/* Radio indicator */}
            <div className={`
              absolute right-4 top-4 h-4 w-4 rounded-full border-2
              ${value === option.value
                ? 'border-blue-600 bg-blue-600'
                : 'border-slate-300 bg-white'
              }
            `}>
              {value === option.value && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
