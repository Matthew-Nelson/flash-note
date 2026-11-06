import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from './ErrorBoundary';

const mockReportErrorBoundary = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({
  reportErrorBoundary: mockReportErrorBoundary,
}));

// Component that throws on demand
function ThrowOnRender({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Child content</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress React's error boundary console output
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should show error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('should report error via telemetry', () => {
    render(
      <ErrorBoundary>
        <ThrowOnRender shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(mockReportErrorBoundary).toHaveBeenCalledWith(
      expect.any(Error)
    );
  });

  it('should render custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowOnRender shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should reset error state when Try Again is clicked', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Child content</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Stop throwing before clicking Try Again, so re-render succeeds
    shouldThrow = false;
    await user.click(screen.getByText('Try Again'));

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should call window.location.reload when Refresh Page is clicked', async () => {
    const user = userEvent.setup();
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
      configurable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowOnRender shouldThrow={true} />
      </ErrorBoundary>
    );

    await user.click(screen.getByText('Refresh Page'));
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it.each(['development', 'production'])(
    'never renders the raw error message or stack (NODE_ENV=%s, Rule 7)',
    (nodeEnv) => {
      vi.stubEnv('NODE_ENV', nodeEnv);
      try {
        const { container } = render(
          <ErrorBoundary>
            <ThrowOnRender shouldThrow={true} />
          </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(container.textContent).not.toContain('Test error');
        expect(container.textContent).not.toContain('ThrowOnRender');
      } finally {
        vi.unstubAllEnvs();
      }
    }
  );
});
