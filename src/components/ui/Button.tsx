import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-jic-orange hover:bg-jic-orange-deep text-white shadow-sm',
    secondary: 'bg-jic-blue hover:bg-jic-blue-bright text-white shadow-sm',
    outline: 'border border-jic-border text-jic-text hover:bg-jic-muted bg-white',
    ghost: 'text-jic-text-secondary hover:bg-jic-muted hover:text-jic-text',
    danger: 'bg-jic-error hover:bg-red-700 text-white shadow-sm',
    success: 'bg-jic-green hover:bg-jic-green-deep text-white shadow-sm',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-jic-orange/30',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
