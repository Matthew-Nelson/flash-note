import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';

// --- vi.hoisted mocks ---

const mockCreatePortalAction = vi.hoisted(() => vi.fn());

vi.mock('@/actions/billing', () => ({
  createPortalAction: mockCreatePortalAction,
}));

// Mock window.location.href
const originalLocation = window.location;

describe('ManageSubscriptionButton', () => {
  beforeEach(() => {
    // Mock window.location.href setter
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('renders with default label', () => {
    render(<ManageSubscriptionButton />);

    expect(screen.getByRole('button', { name: /manage subscription/i })).toBeInTheDocument();
  });

  it('renders with custom label', () => {
    render(<ManageSubscriptionButton label="Update payment method" />);

    expect(screen.getByRole('button', { name: /update payment method/i })).toBeInTheDocument();
  });

  it('shows loading state on click', async () => {
    const user = userEvent.setup();
    // Make portal action hang (loading state visible)
    mockCreatePortalAction.mockImplementation(
      () => new Promise<never>(() => {})
    );

    render(<ManageSubscriptionButton />);

    const button = screen.getByRole('button', { name: /manage subscription/i });
    await act(async () => {
      await user.click(button);
    });

    expect(button).toBeDisabled();
  });

  it('shows error message when action returns error', async () => {
    const user = userEvent.setup();
    mockCreatePortalAction.mockResolvedValue({ success: false, error: 'billing_error' });

    render(<ManageSubscriptionButton />);

    const button = screen.getByRole('button', { name: /manage subscription/i });
    await act(async () => {
      await user.click(button);
    });

    // Rule 2: error message is a curated string, not the raw error code
    expect(
      await screen.findByText('Failed to open billing portal. Please try again or contact support.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/billing_error/)).not.toBeInTheDocument();
    expect(window.location.href).toBe('');
  });

  it('shows error and does not navigate when portal URL is not a Stripe host (open redirect guard)', async () => {
    const user = userEvent.setup();
    mockCreatePortalAction.mockResolvedValue({
      success: true,
      data: { portalUrl: 'https://evil.example.com/steal' },
    });

    render(<ManageSubscriptionButton />);

    const button = screen.getByRole('button', { name: /manage subscription/i });
    await act(async () => {
      await user.click(button);
    });

    expect(
      await screen.findByText('Invalid billing portal URL. Please contact support.')
    ).toBeInTheDocument();
    expect(window.location.href).toBe('');
  });

  it('sets window.location.href on success', async () => {
    const user = userEvent.setup();
    const portalUrl = 'https://billing.stripe.com/portal/sess123';
    mockCreatePortalAction.mockResolvedValue({
      success: true,
      data: { portalUrl },
    });

    render(<ManageSubscriptionButton />);

    const button = screen.getByRole('button', { name: /manage subscription/i });
    await act(async () => {
      await user.click(button);
    });

    await waitFor(() => {
      expect(window.location.href).toBe(portalUrl);
    });
  });
});
