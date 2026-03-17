import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from './Footer';

describe('Footer', () => {
  it('renders company name "FlashNote"', () => {
    render(<Footer />);
    // The footer heading (not a link)
    expect(screen.getByText('FlashNote')).toBeInTheDocument();
  });

  it('renders all column headings', () => {
    render(<Footer />);
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('Legal')).toBeInTheDocument();
  });

  it('renders Pricing link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Pricing' });
    expect(link).toHaveAttribute('href', '/pricing');
  });

  it('renders Help Center link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Help Center' });
    expect(link).toHaveAttribute('href', '/help');
  });

  it('renders Contact mailto link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Contact' });
    expect(link).toHaveAttribute('href', 'mailto:support@flashnote.co');
  });

  it('renders Privacy Policy link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(link).toHaveAttribute('href', '/privacy');
  });

  it('renders Terms of Service link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'Terms of Service' });
    expect(link).toHaveAttribute('href', '/terms');
  });

  it('renders BAA link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: 'BAA' });
    expect(link).toHaveAttribute('href', '/baa');
  });

  it('does not render a Demo link', () => {
    render(<Footer />);
    expect(screen.queryByRole('link', { name: /demo/i })).not.toBeInTheDocument();
  });

  it('renders dynamic copyright year', () => {
    render(<Footer />);
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument();
  });

  it('footer links have min-h-[44px] for touch target compliance', () => {
    render(<Footer />);
    const pricingLink = screen.getByRole('link', { name: 'Pricing' });
    expect(pricingLink.className).toContain('min-h-[44px]');
    const privacyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    expect(privacyLink.className).toContain('min-h-[44px]');
    const baaLink = screen.getByRole('link', { name: 'BAA' });
    expect(baaLink.className).toContain('min-h-[44px]');
  });
});
