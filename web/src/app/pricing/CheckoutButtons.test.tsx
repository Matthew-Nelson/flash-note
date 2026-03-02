import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckoutButtons } from './CheckoutButtons';

// --- vi.hoisted mocks ---

const mockCreateCheckoutAction = vi.hoisted(() => vi.fn());
const mockIsAllowedRedirectUrl = vi.hoisted(() => vi.fn());
const mockRouterPush = vi.hoisted(() => vi.fn());

const mockSearchParams = vi.hoisted(() => ({
  get: vi.fn().mockReturnValue(null),
}));

vi.mock('@/actions/billing', () => ({
  createCheckoutAction: mockCreateCheckoutAction,
}));

vi.mock('@/lib/utils/redirect-validation', () => ({
  isAllowedRedirectUrl: mockIsAllowedRedirectUrl,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => mockSearchParams,
}));

// Mock window.history.replaceState and window.location.href
const mockReplaceState = vi.fn();
const originalLocation = window.location;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderButtons(overrides: Partial<React.ComponentProps<typeof CheckoutButtons>> = {}) {
  const props: React.ComponentProps<typeof CheckoutButtons> = {
    isAuthenticated: true,
    priceMonthly: 'price_monthly',
    priceAnnual: 'price_annual',
    ...overrides,
  };
  return render(<CheckoutButtons {...props} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CheckoutButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.get.mockReturnValue(null);
    mockIsAllowedRedirectUrl.mockReturnValue(true);

    Object.defineProperty(window, 'history', {
      value: { replaceState: mockReplaceState },
      writable: true,
    });
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

  it('renders Subscribe Now buttons when authenticated', () => {
    renderButtons({ isAuthenticated: true });

    const buttons = screen.getAllByRole('button', { name: /subscribe now/i });
    expect(buttons).toHaveLength(2); // monthly + annual
  });

  it('renders Start Free Trial buttons when not authenticated', () => {
    renderButtons({ isAuthenticated: false });

    const buttons = screen.getAllByRole('button', { name: /start free trial/i });
    expect(buttons).toHaveLength(2);
  });

  it('shows canceled alert when ?canceled=true URL param is present', () => {
    mockSearchParams.get.mockReturnValue('true');

    renderButtons();

    expect(screen.getByText(/Checkout was canceled/i)).toBeInTheDocument();
  });

  it('strips ?canceled=true from URL via replaceState', () => {
    mockSearchParams.get.mockReturnValue('true');

    renderButtons();

    expect(mockReplaceState).toHaveBeenCalledWith({}, '', '/pricing');
  });

  it('redirects to signup when not authenticated and plan clicked', async () => {
    const user = userEvent.setup();
    renderButtons({ isAuthenticated: false });

    const [monthlyButton] = screen.getAllByRole('button', { name: /start free trial/i });
    await act(async () => {
      await user.click(monthlyButton);
    });

    expect(mockRouterPush).toHaveBeenCalledWith('/signup?plan=monthly');
    expect(mockCreateCheckoutAction).not.toHaveBeenCalled();
  });

  it('calls createCheckoutAction with correct priceId on monthly click', async () => {
    const user = userEvent.setup();
    mockCreateCheckoutAction.mockResolvedValue({
      success: true,
      data: { checkoutUrl: 'https://checkout.stripe.com/sess' },
    });

    renderButtons();

    const [monthlyButton] = screen.getAllByRole('button', { name: /subscribe now/i });
    await act(async () => {
      await user.click(monthlyButton);
    });

    const formData = mockCreateCheckoutAction.mock.calls[0]?.[0] as FormData;
    expect(formData.get('priceId')).toBe('price_monthly');
  });

  it('calls createCheckoutAction with annual priceId on annual click', async () => {
    const user = userEvent.setup();
    mockCreateCheckoutAction.mockResolvedValue({
      success: true,
      data: { checkoutUrl: 'https://checkout.stripe.com/sess' },
    });

    renderButtons();

    const buttons = screen.getAllByRole('button', { name: /subscribe now/i });
    await act(async () => {
      await user.click(buttons[1]); // annual button
    });

    const formData = mockCreateCheckoutAction.mock.calls[0]?.[0] as FormData;
    expect(formData.get('priceId')).toBe('price_annual');
  });

  it('redirects to checkout URL on success', async () => {
    const user = userEvent.setup();
    const checkoutUrl = 'https://checkout.stripe.com/sess123';
    mockCreateCheckoutAction.mockResolvedValue({
      success: true,
      data: { checkoutUrl },
    });

    renderButtons();

    const [monthlyButton] = screen.getAllByRole('button', { name: /subscribe now/i });
    await act(async () => {
      await user.click(monthlyButton);
    });

    await waitFor(() => {
      expect(window.location.href).toBe(checkoutUrl);
    });
  });

  it('shows error for email_not_verified (Rule 2: curated message)', async () => {
    const user = userEvent.setup();
    mockCreateCheckoutAction.mockResolvedValue({
      success: false,
      error: 'email_not_verified',
    });

    renderButtons();

    const [monthlyButton] = screen.getAllByRole('button', { name: /subscribe now/i });
    await act(async () => {
      await user.click(monthlyButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/verify your email/i)).toBeInTheDocument();
    });
  });

  it('shows error for subscription_exists (Rule 2: curated message)', async () => {
    const user = userEvent.setup();
    mockCreateCheckoutAction.mockResolvedValue({
      success: false,
      error: 'subscription_exists',
    });

    renderButtons();

    const [monthlyButton] = screen.getAllByRole('button', { name: /subscribe now/i });
    await act(async () => {
      await user.click(monthlyButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/already have an active subscription/i)).toBeInTheDocument();
    });
  });

  it('shows generic error for unknown billing error (Rule 2: curated message)', async () => {
    const user = userEvent.setup();
    mockCreateCheckoutAction.mockResolvedValue({
      success: false,
      error: 'billing_error',
    });

    renderButtons();

    const [monthlyButton] = screen.getAllByRole('button', { name: /subscribe now/i });
    await act(async () => {
      await user.click(monthlyButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to start checkout/i)).toBeInTheDocument();
    });
  });

  it('shows error when price IDs are not configured', async () => {
    const user = userEvent.setup();

    renderButtons({ priceMonthly: '', priceAnnual: '' });

    const [monthlyButton] = screen.getAllByRole('button', { name: /subscribe now/i });
    await act(async () => {
      await user.click(monthlyButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Pricing is not configured/i)).toBeInTheDocument();
    });
    // Should NOT call the action if no priceId
    expect(mockCreateCheckoutAction).not.toHaveBeenCalled();
  });
});
