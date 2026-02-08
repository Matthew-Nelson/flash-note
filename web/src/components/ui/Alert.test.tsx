import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Alert } from './Alert';

describe('Alert', () => {
  it('should render children', () => {
    render(<Alert variant="info">Test message</Alert>);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should have role="alert"', () => {
    render(<Alert variant="info">Alert</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it.each(['success', 'error', 'warning', 'info'] as const)(
    'should apply %s variant class',
    (variant) => {
      render(<Alert variant={variant}>Message</Alert>);
      const el = screen.getByRole('alert');
      expect(el.className).toContain(`alert-${variant}`);
    }
  );

  it('should show dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(
      <Alert variant="info" onDismiss={onDismiss}>
        Dismissible
      </Alert>
    );
    expect(screen.getByLabelText('Dismiss')).toBeInTheDocument();
  });

  it('should NOT show dismiss button when onDismiss is absent', () => {
    render(<Alert variant="info">Not dismissible</Alert>);
    expect(screen.queryByLabelText('Dismiss')).not.toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <Alert variant="error" onDismiss={onDismiss}>
        Error
      </Alert>
    );

    await user.click(screen.getByLabelText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should forward additional className', () => {
    render(
      <Alert variant="info" className="custom-class">
        Styled
      </Alert>
    );
    expect(screen.getByRole('alert').className).toContain('custom-class');
  });
});
