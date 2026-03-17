import type { Metadata } from 'next';
import { MarketingNav } from '@/components/MarketingNav';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Privacy Policy | FlashNote',
  description: 'FlashNote Privacy Policy - Learn how we collect, use, and protect your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-fn-bg-primary">
      <MarketingNav />

      {/* Content */}
      <main id="main-content" tabIndex={-1} className="container mx-auto px-6 py-12 leading-relaxed">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-fn-text-primary mb-2">Privacy Policy</h1>
          <p className="text-fn-text-muted mb-8">Version 0.1 &mdash; Draft</p>

          <div className="bg-fn-bg-secondary border border-fn-border rounded-fn-md p-6">
            <p className="text-fn-text-primary font-semibold mb-2">PENDING LEGAL REVIEW</p>
            <p className="text-fn-text-secondary mb-4">
              Our Privacy Policy is currently being finalized by legal counsel. The final
              document will be published here before FlashNote is generally available.
            </p>
            <p className="text-fn-text-secondary">
              For questions, contact us at{' '}
              <a href="mailto:privacy@flashnote.co" className="link">privacy@flashnote.co</a>.
            </p>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
}
