import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Business Associate Agreement | FlashNote',
  description: 'FlashNote Business Associate Agreement (BAA) - HIPAA-compliant terms for covered entities using our service.',
};

export default function BaaPage() {
  return (
    <div className="min-h-screen bg-fn-bg-primary">
      {/* Navigation */}
      <nav aria-label="Main" className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-fn-primary">
            FlashNote
          </Link>
          <div className="flex items-center space-x-6">
            <Link
              href="/pricing"
              className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-fn-text-secondary hover:text-fn-text-primary transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="btn-primary px-4 py-2"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main id="main-content" tabIndex={-1} className="container mx-auto px-6 py-12">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-fn-text-primary mb-2">Business Associate Agreement</h1>
          <p className="text-fn-text-muted mb-8">Version 0.1 &mdash; Draft</p>

          <div className="bg-fn-bg-secondary border border-fn-border rounded-fn-md p-6">
            <p className="text-fn-text-primary font-semibold mb-2">PENDING LEGAL REVIEW</p>
            <p className="text-fn-text-secondary mb-4">
              Our Business Associate Agreement is currently being finalized by legal counsel.
              The final document will be published here before FlashNote is generally available.
            </p>
            <p className="text-fn-text-secondary">
              For questions or to request a BAA, contact us at{' '}
              <a href="mailto:legal@flashnote.co" className="link">legal@flashnote.co</a>.
            </p>
          </div>
        </article>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-fn-bg-inverse text-fn-text-inverse py-12 mt-12">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <div className="text-xl font-bold text-white mb-4">FlashNote</div>
            <p className="text-sm text-fn-text-inverse/70">
              AI-powered documentation for physical therapists.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white mb-4">Product</p>
            <ul className="space-y-2 text-sm text-fn-text-inverse/70">
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-4">Support</p>
            <ul className="space-y-2 text-sm text-fn-text-inverse/70">
              <li>
                <a href="mailto:support@flashnote.co" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-4">Legal</p>
            <ul className="space-y-2 text-sm text-fn-text-inverse/70">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/baa" className="hover:text-white transition-colors">
                  BAA
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-fn-text-inverse/20 mt-8 pt-8 text-sm text-center text-fn-text-inverse/70">
          &copy; {new Date().getFullYear()} FlashNote. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
