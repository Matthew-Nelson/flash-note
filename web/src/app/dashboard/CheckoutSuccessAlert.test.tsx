import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutSuccessAlert } from './CheckoutSuccessAlert';

// Mock next/navigation
const mockSearchParams = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock window.history.replaceState
const mockReplaceState = vi.hoisted(() => vi.fn());

describe('CheckoutSuccessAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.get.mockReturnValue(null);
    Object.defineProperty(window, 'history', {
      value: { replaceState: mockReplaceState },
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no ?success param', () => {
    mockSearchParams.get.mockReturnValue(null);

    const { container } = render(<CheckoutSuccessAlert />);

    expect(container.firstChild).toBeNull();
  });

  it('renders alert when ?success=true', () => {
    mockSearchParams.get.mockReturnValue('true');

    render(<CheckoutSuccessAlert />);

    expect(
      screen.getByText(/Subscription activated/i)
    ).toBeInTheDocument();
  });

  it('strips ?success=true from URL via replaceState', () => {
    mockSearchParams.get.mockReturnValue('true');

    render(<CheckoutSuccessAlert />);

    expect(mockReplaceState).toHaveBeenCalledWith({}, '', '/dashboard');
  });

  it('dismisses alert on dismiss click', async () => {
    mockSearchParams.get.mockReturnValue('true');
    const user = userEvent.setup();

    render(<CheckoutSuccessAlert />);
    expect(screen.getByText(/Subscription activated/i)).toBeInTheDocument();

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    await act(async () => {
      await user.click(dismissButton);
    });

    expect(screen.queryByText(/Subscription activated/i)).not.toBeInTheDocument();
  });

  it('does not show alert when ?success=false', () => {
    mockSearchParams.get.mockReturnValue('false');

    const { container } = render(<CheckoutSuccessAlert />);

    expect(container.firstChild).toBeNull();
  });
});
