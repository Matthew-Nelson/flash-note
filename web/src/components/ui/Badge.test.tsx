import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, SubscriptionBadge } from './Badge';

describe('Badge', () => {
  it.each(['trial', 'active', 'expired'] as const)(
    'should apply %s variant class',
    (variant) => {
      render(<Badge variant={variant}>Label</Badge>);
      expect(screen.getByText('Label').className).toContain(`badge-${variant}`);
    }
  );

  it('should render children', () => {
    render(<Badge variant="active">Custom Label</Badge>);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('should forward additional className', () => {
    render(
      <Badge variant="active" className="extra">
        Label
      </Badge>
    );
    expect(screen.getByText('Label').className).toContain('extra');
  });
});

describe('SubscriptionBadge', () => {
  it('should show "Active" for active status', () => {
    render(<SubscriptionBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show "Free Trial" for trialing status', () => {
    render(<SubscriptionBadge status="trialing" />);
    expect(screen.getByText('Free Trial')).toBeInTheDocument();
  });

  it('should show "Expired" for unknown status', () => {
    render(<SubscriptionBadge status="cancelled" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });
});
