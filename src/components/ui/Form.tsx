import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function Field({ label, required, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-jic-text">
        {label}
        {required && <span className="text-jic-error ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-jic-error">{error}</p>}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl border border-jic-border bg-white text-sm text-jic-text placeholder:text-jic-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all',
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl border border-jic-border bg-white text-sm text-jic-text placeholder:text-jic-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all resize-none',
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl border border-jic-border bg-white text-sm text-jic-text focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
