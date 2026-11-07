import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import TemplatesPage from './page';
import type { SessionData } from '@/server/types';
import { createMockSession } from '@/test/factories/session-factory';

// Mock getSession
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

// Mock TopBar (Client Component)
vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">
      <h1>{title}</h1>
    </header>
  ),
}));

describe('TemplatesPage', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
  });

  it('redirects to /login?reason=session_expired when no session (Rule 8)', async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(TemplatesPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders TopBar with title "Templates"', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await TemplatesPage());

    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Templates' })).toBeInTheDocument();
  });

  it('renders "Coming Soon" heading', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await TemplatesPage());

    expect(screen.getByRole('heading', { level: 2, name: 'Coming Soon' })).toBeInTheDocument();
  });

  it('renders description text about custom templates', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await TemplatesPage());

    expect(screen.getByText(/Custom templates are on the way/)).toBeInTheDocument();
  });

  it('renders main#main-content', async () => {
    mockGetSession.mockResolvedValue(createMockSession());

    render(await TemplatesPage());

    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  });
});
