import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteAccountSection } from './DeleteAccountSection';

// Mock UI components
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

describe('DeleteAccountSection', () => {
  it('renders initial state with warning and delete button', () => {
    render(<DeleteAccountSection />);

    expect(screen.getByText(/Once you delete your account/)).toBeInTheDocument();
    expect(screen.getByText('Delete Account')).toBeInTheDocument();
  });

  it('shows confirmation panel on delete button click', async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByText('Delete Account'));

    expect(
      screen.getByText('Are you sure you want to delete your account?')
    ).toBeInTheDocument();
    expect(screen.getByText('Contact Support')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('returns to initial state on cancel', async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByText('Delete Account'));
    expect(
      screen.getByText('Are you sure you want to delete your account?')
    ).toBeInTheDocument();

    await user.click(screen.getByText('Cancel'));
    expect(screen.getByText(/Once you delete your account/)).toBeInTheDocument();
    expect(
      screen.queryByText('Are you sure you want to delete your account?')
    ).not.toBeInTheDocument();
  });

  it('has correct mailto link for support', async () => {
    const user = userEvent.setup();
    render(<DeleteAccountSection />);

    await user.click(screen.getByText('Delete Account'));

    const contactLink = screen.getByText('Contact Support');
    expect(contactLink.closest('a')).toHaveAttribute(
      'href',
      'mailto:support@flashnote.co?subject=Account%20Deletion%20Request'
    );
  });
});
