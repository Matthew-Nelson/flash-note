import { type HTMLAttributes } from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-8 h-8 border-4',
};

export function Spinner({ size = 'md', className = '', ...props }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${sizeClasses[size]} rounded-full animate-spin ${className}`}
      style={{
        borderColor: 'var(--fn-bg-tertiary)',
        borderTopColor: 'currentColor',
      }}
      {...props}
    />
  );
}

export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div className={`loading-spinner ${className}`} role="status" aria-label="Loading">
      <div className="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}
