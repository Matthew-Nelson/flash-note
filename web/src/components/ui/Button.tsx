import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  const isDisabled = disabled || loading;

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} inline-flex items-center justify-center gap-2 ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
