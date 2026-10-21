import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'orange' | 'blue' | 'green' | 'yellow' | 'red' | 'slate';
  onClick?: () => void;
  subtitle?: string;
}

export function KPICard({ label, value, icon: Icon, color, onClick, subtitle }: KPICardProps) {
  const colors = {
    orange: { bg: 'bg-jic-orange-soft', text: 'text-jic-orange', icon: 'text-jic-orange' },
    blue: { bg: 'bg-jic-blue-soft', text: 'text-jic-blue', icon: 'text-jic-blue' },
    green: { bg: 'bg-jic-green-soft', text: 'text-jic-green', icon: 'text-jic-green' },
    yellow: { bg: 'bg-jic-yellow-soft', text: 'text-jic-yellow', icon: 'text-jic-yellow' },
    red: { bg: 'bg-jic-error-bg', text: 'text-jic-error', icon: 'text-jic-error' },
    slate: { bg: 'bg-jic-muted', text: 'text-jic-text-secondary', icon: 'text-jic-text-secondary' },
  };

  const c = colors[color];

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-jic-border p-4 flex flex-col gap-3 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-jic-orange/30'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-jic-text-secondary uppercase tracking-wide">{label}</span>
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', c.bg)}>
          <Icon className={cn('w-5 h-5', c.icon)} />
        </div>
      </div>
      <div>
        <p className={cn('text-2xl font-bold', c.text)}>{value}</p>
        {subtitle && <p className="text-xs text-jic-text-secondary mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
