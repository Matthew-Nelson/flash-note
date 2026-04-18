import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import type { SessionData } from '@/server/types';

const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">{title}</header>
  ),
}));

vi.mock('@/components/patients', () => ({
  PatientCreateForm: () => <form data-testid="create-form" />,
}));

import NewPatientPage from './page';

function session(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 's',
    userId: 'user-1',
    email: 'pt@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date('2026-06-01'),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

describe('NewPatientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('redirects to /login when unauthenticated (Rule 8)', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(NewPatientPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders <main id="main-content"> (Rule 14)', async () => {
    mockGetSession.mockResolvedValue(session());
    render(await NewPatientPage());
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });

  it('renders single <h1> "Add patient"', async () => {
    mockGetSession.mockResolvedValue(session());
    const { container } = render(await NewPatientPage());
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Add patient');
  });

  it('renders PatientCreateForm', async () => {
    mockGetSession.mockResolvedValue(session());
    render(await NewPatientPage());
    expect(screen.getByTestId('create-form')).toBeInTheDocument();
  });
});
