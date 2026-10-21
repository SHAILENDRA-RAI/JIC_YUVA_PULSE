import { cn } from '@/lib/utils';

export function Card({ className, children, ...props }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn('bg-white rounded-2xl border border-jic-border shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 py-4 border-b border-jic-border">
      <div>
        <h3 className="font-bold text-jic-text text-base">{title}</h3>
        {subtitle && <p className="text-sm text-jic-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-5', className)}>{children}</div>;
}
