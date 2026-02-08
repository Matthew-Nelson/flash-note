import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Providers from './Providers';

// Mock ErrorBoundary and AuthProvider to isolate composition testing
vi.mock('./ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

vi.mock('@/lib/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

describe('Providers', () => {
  it('should render children inside ErrorBoundary and AuthProvider', () => {
    render(
      <Providers>
        <div data-testid="child">Hello</div>
      </Providers>
    );

    expect(screen.getByTestId('error-boundary')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('should nest AuthProvider inside ErrorBoundary', () => {
    render(
      <Providers>
        <span>Content</span>
      </Providers>
    );

    const errorBoundary = screen.getByTestId('error-boundary');
    const authProvider = screen.getByTestId('auth-provider');
    expect(errorBoundary).toContainElement(authProvider);
  });
});
