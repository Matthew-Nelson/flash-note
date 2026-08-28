import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { redirect } from 'next/navigation';
import type { SessionData } from '@/server/types';
import { createMockPatient } from '@/test/factories/patient-factory';

// Mocks
const mockGetSession = vi.fn<() => Promise<SessionData | null>>();
vi.mock('@/server/lib/get-session', () => ({
  getSession: (): Promise<SessionData | null> => mockGetSession(),
}));

const mockFindPatientsByScope =
  vi.fn<
    (
      scope: unknown,
      input?: unknown,
    ) => Promise<{ patients: unknown[]; total: number }>
  >();
vi.mock('@/server/dal', () => ({
  findPatientsByScope: (
    scope: unknown,
    input?: unknown,
  ): Promise<{ patients: unknown[]; total: number }> =>
    mockFindPatientsByScope(scope, input),
}));

vi.mock('@/components/TopBar', () => ({
  TopBar: ({ title }: { title: string }) => (
    <header data-testid="top-bar">
      <span>{title}</span>
    </header>
  ),
}));

// The real SearchPatients and PatientRow are Client Components; avoid Next's
// client-only runtime in a Server Component test by swapping them for stubs.
vi.mock('@/components/patients', () => ({
  SearchPatients: ({ initialQuery }: { initialQuery: string }) => (
    <div data-testid="search-patients" data-query={initialQuery} />
  ),
  PatientRow: ({ patient }: { patient: { id: string; firstName: string; lastName: string } }) => (
    <tr data-testid={`patient-row-${patient.id}`}>
      <td>
        {patient.firstName} {patient.lastName}
      </td>
    </tr>
  ),
}));

import PatientsPage, { PatientsTable } from './page';

function session(overrides: Partial<SessionData> = {}): SessionData {
  return {
    sessionId: 'sess',
    userId: 'user-1',
    email: 'pt@example.com',
    subscriptionStatus: 'trialing',
    trialEndsAt: new Date('2026-06-01'),
    emailVerified: true,
    organizationId: null,
    ...overrides,
  };
}

describe('PatientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redirect).mockImplementation((): never => {
      throw new Error('NEXT_REDIRECT');
    });
    mockFindPatientsByScope.mockResolvedValue({ patients: [], total: 0 });
  });

  it('redirects to /login when unauthenticated (Rule 8)', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(
      PatientsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('renders <main id="main-content"> (Rule 14)', async () => {
    mockGetSession.mockResolvedValue(session());
    render(await PatientsPage({ searchParams: Promise.resolve({}) }));
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
  });

  it('renders exactly one <h1> with "Patients"', async () => {
    mockGetSession.mockResolvedValue(session());
    const { container } = render(
      await PatientsPage({ searchParams: Promise.resolve({}) }),
    );
    const h1s = container.querySelectorAll('h1');
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Patients');
  });

  // Regression: Next.js resolves ?q=a&q=b to string[]; sp.q.trim() threw a
  // TypeError and dropped the route into the error boundary.
  it('renders instead of throwing when q and page repeat in the URL', async () => {
    mockGetSession.mockResolvedValue(session());
    render(
      await PatientsPage({
        searchParams: Promise.resolve({ q: ['doe', 'smith'], page: ['2', '7'] }),
      }),
    );
    expect(screen.getByTestId('search-patients')).toHaveAttribute(
      'data-query',
      'doe',
    );
  });

  it('passes q to SearchPatients', async () => {
    mockGetSession.mockResolvedValue(session());
    render(
      await PatientsPage({ searchParams: Promise.resolve({ q: 'doe' }) }),
    );
    expect(screen.getByTestId('search-patients')).toHaveAttribute(
      'data-query',
      'doe',
    );
  });
});

// PatientsTable owns the DB call (it's the async Suspense child in page.tsx).
// These assertions target that component directly, since RTL would render the
// Suspense fallback rather than awaiting the inner async component.
describe('PatientsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindPatientsByScope.mockResolvedValue({ patients: [], total: 0 });
  });

  it('calls DAL with user scope', async () => {
    await PatientsTable({ userId: 'abc', q: '', page: 1 });
    expect(mockFindPatientsByScope).toHaveBeenCalledWith(
      { type: 'user', userId: 'abc' },
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('renders empty state when no patients AND no search query', async () => {
    mockFindPatientsByScope.mockResolvedValueOnce({ patients: [], total: 0 });
    render(await PatientsTable({ userId: 'u', q: '', page: 1 }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'No patients yet',
    );
    expect(
      screen.getByText(/Create your first patient/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: /add patient/i }).length,
    ).toBeGreaterThan(0);
  });

  it('renders search-scoped empty state when query yields no results', async () => {
    mockFindPatientsByScope.mockResolvedValueOnce({ patients: [], total: 0 });
    render(await PatientsTable({ userId: 'u', q: 'zelda', page: 1 }));
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'No patients match "zelda"',
    );
  });

  it('forwards search query to DAL', async () => {
    await PatientsTable({ userId: 'u', q: 'doe', page: 1 });
    expect(mockFindPatientsByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ search: 'doe' }),
    );
  });

  it('renders PatientRow for each patient', async () => {
    mockFindPatientsByScope.mockResolvedValueOnce({
      patients: [
        createMockPatient({ id: 'p1', firstName: 'Jane', lastName: 'Doe' }),
        createMockPatient({ id: 'p2', firstName: 'John', lastName: 'Smith' }),
      ],
      total: 2,
    });
    render(await PatientsTable({ userId: 'u', q: '', page: 1 }));
    expect(screen.getByTestId('patient-row-p1')).toBeInTheDocument();
    expect(screen.getByTestId('patient-row-p2')).toBeInTheDocument();
  });

  it('pagination renders when total > PAGE_SIZE', async () => {
    mockFindPatientsByScope.mockResolvedValueOnce({
      patients: Array.from({ length: 50 }, (_, i) =>
        createMockPatient({
          id: `p${i}`,
          firstName: `First${i}`,
          lastName: `Last${i}`,
        }),
      ),
      total: 125,
    });
    render(await PatientsTable({ userId: 'u', q: '', page: 2 }));
    expect(
      screen.getByRole('navigation', { name: /pagination/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('no pagination when total fits on one page', async () => {
    mockFindPatientsByScope.mockResolvedValueOnce({
      patients: [
        createMockPatient({ id: 'p1', firstName: 'Jane', lastName: 'Doe' }),
      ],
      total: 1,
    });
    render(await PatientsTable({ userId: 'u', q: '', page: 1 }));
    expect(
      screen.queryByRole('navigation', { name: /pagination/i }),
    ).not.toBeInTheDocument();
  });

  it('page offset is computed from the page prop', async () => {
    await PatientsTable({ userId: 'u', q: '', page: 3 });
    expect(mockFindPatientsByScope).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 50, offset: 100 }),
    );
  });
});
