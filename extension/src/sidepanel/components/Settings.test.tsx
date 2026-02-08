import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from './Settings';
import { storage } from '@/shared/storage';
import { createMockUser, createMockPreferences } from '@/test/helpers';

vi.mock('@/shared/storage', () => ({
  storage: {
    getPreferences: vi.fn(),
    setPreferences: vi.fn(),
  },
}));

describe('Settings', () => {
  const onLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.getPreferences).mockResolvedValue(createMockPreferences());
    vi.mocked(storage.setPreferences).mockResolvedValue(undefined);
  });

  function renderSettings(userOverrides = {}) {
    const user = createMockUser(userOverrides);
    return render(<Settings user={user} onLogout={onLogout} />);
  }

  it('should display user email', () => {
    renderSettings();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('should display trial status with days left', () => {
    renderSettings({
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(screen.getByText(/Trial \(\d+ days left\)/)).toBeInTheDocument();
  });

  it('should display active status', () => {
    renderSettings({ subscriptionStatus: 'active' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show View Plans link for trialing users', () => {
    renderSettings({ subscriptionStatus: 'trialing' });
    expect(screen.getByText('View Plans')).toBeInTheDocument();
  });

  it('should show Manage subscription link for active users', () => {
    renderSettings({ subscriptionStatus: 'active' });
    expect(screen.getByText('Manage subscription')).toBeInTheDocument();
  });

  it('should toggle floating badge preference', async () => {
    const user = userEvent.setup();
    renderSettings();

    const toggle = await screen.findByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toggle);

    expect(storage.setPreferences).toHaveBeenCalledWith({
      showFloatingBadge: false,
    });
  });

  it('should revert toggle on save failure', async () => {
    vi.mocked(storage.setPreferences).mockRejectedValue(new Error('Save failed'));
    const user = userEvent.setup();
    renderSettings();

    const toggle = await screen.findByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('should call onLogout when Sign Out is clicked', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Sign Out'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
