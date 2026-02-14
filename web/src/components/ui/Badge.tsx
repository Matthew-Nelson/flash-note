import { type HTMLAttributes, type ReactNode } from 'react';

type BadgeVariant = 'trial' | 'active' | 'cancelling' | 'expired';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  trial: 'badge-trial',
  active: 'badge-active',
  cancelling: 'badge-expired',
  expired: 'badge-expired',
};

const defaultLabels: Record<BadgeVariant, string> = {
  trial: 'Free Trial',
  active: 'Active',
  cancelling: 'Cancelling',
  expired: 'Expired',
};

export function Badge({ variant, children, className = '', ...props }: BadgeProps) {
  return (
    <span className={`badge ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}

export function SubscriptionBadge({ status, cancelAtPeriodEnd }: { status: string; cancelAtPeriodEnd?: boolean }) {
  const variant: BadgeVariant =
    status === 'active' && cancelAtPeriodEnd ? 'cancelling' :
    status === 'active' ? 'active' :
    status === 'trialing' ? 'trial' :
    'expired';

  return <Badge variant={variant}>{defaultLabels[variant]}</Badge>;
}
