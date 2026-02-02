import { type HTMLAttributes, type ReactNode } from 'react';

type BadgeVariant = 'trial' | 'active' | 'expired';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  trial: 'badge-trial',
  active: 'badge-active',
  expired: 'badge-expired',
};

const defaultLabels: Record<BadgeVariant, string> = {
  trial: 'Free Trial',
  active: 'Active',
  expired: 'Expired',
};

export function Badge({ variant, children, className = '', ...props }: BadgeProps) {
  return (
    <span className={`badge ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}

export function SubscriptionBadge({ status }: { status: string }) {
  const variant: BadgeVariant =
    status === 'active' ? 'active' :
    status === 'trialing' ? 'trial' :
    'expired';

  return <Badge variant={variant}>{defaultLabels[variant]}</Badge>;
}
