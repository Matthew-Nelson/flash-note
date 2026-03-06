import type { Metadata } from 'next';
import { MarketingNav } from '@/components/MarketingNav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Terms of Service | FlashNote',
  description: 'FlashNote Terms of Service - Read our terms and conditions for using our service.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-fn-bg-primary">
      <MarketingNav />

      {/* Content */}
      <main id="main-content" tabIndex={-1} className="container mx-auto px-6 py-12">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-fn-text-primary mb-2">Terms of Service</h1>
          <p className="text-fn-text-muted mb-8">Version 0.1 &mdash; Draft</p>

          <div className="bg-fn-bg-secondary border border-fn-border rounded-fn-md p-6">
            <p className="text-fn-text-primary font-semibold mb-2">PENDING LEGAL REVIEW</p>
            <p className="text-fn-text-secondary mb-4">
              Our Terms of Service are currently being finalized by legal counsel. The final
              document will be published here before FlashNote is generally available.
            </p>
            <p className="text-fn-text-secondary">
              For questions, contact us at{' '}
              <a href="mailto:legal@flashnote.co" className="link">legal@flashnote.co</a>.
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
