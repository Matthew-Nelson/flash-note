import { type ButtonHTMLAttributes, type ReactNode, forwardRef } from 'react';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'destructive';
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

/**
 * Destructive variant classes. Background `--fn-error`, hover `--fn-error-dark`,
 * white text. Same focus-ring rules as every other variant (inherits global
 * `:focus-visible` rule from globals.css). UI-SPEC §Color §Destructive.
 */
const DESTRUCTIVE_CLASSES =
  'bg-fn-error hover:bg-fn-error-dark text-white rounded-fn-base font-semibold ' +
  'transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

function variantClasses(variant: ButtonVariant): string {
  if (variant === 'destructive') return DESTRUCTIVE_CLASSES;
  return variant === 'primary' ? 'btn-primary' : 'btn-secondary';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    children,
    className = '',
    ...props
  },
  ref,
) {
  const baseClasses = variantClasses(variant);
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${sizeClasses[size]} inline-flex items-center justify-center gap-2 min-h-[44px] cursor-pointer ${className}`}
      disabled={isDisabled}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});
