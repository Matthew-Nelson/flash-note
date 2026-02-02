import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy | FlashNote',
  description: 'FlashNote Privacy Policy - Learn how we collect, use, and protect your information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-fn-bg-primary">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gradient">
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
      <main className="container mx-auto px-6 py-12">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-bold text-fn-text-primary mb-2">Privacy Policy</h1>
          <p className="text-fn-text-muted mb-8">Last Updated: February 2026</p>

          <div className="prose prose-slate max-w-none">
            <p className="text-fn-text-secondary text-lg mb-8">
              <strong>FlashNote</strong> (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our browser extension and related services.
            </p>

            <Section title="Information We Collect">
              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Account Information</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1 mb-4">
                <li>Email address (for authentication)</li>
                <li>Password (stored as a secure hash)</li>
              </ul>

              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Usage Information</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1 mb-4">
                <li>Number of notes generated</li>
                <li>Feature usage statistics</li>
                <li>Error logs (without PHI)</li>
              </ul>

              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">What We Do NOT Collect or Store</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Patient names</li>
                <li>Patient notes content</li>
                <li>Protected Health Information (PHI)</li>
                <li>Generated SOAP notes (pass-through only)</li>
              </ul>
            </Section>

            <Section title="How We Use Your Information">
              <p className="text-fn-text-secondary mb-4">We use the information we collect to:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Provide and maintain our service</li>
                <li>Process your subscription and payments</li>
                <li>Send important service notifications</li>
                <li>Improve our product and user experience</li>
                <li>Comply with legal obligations</li>
              </ul>
            </Section>

            <Section title="HIPAA Compliance">
              <p className="text-fn-text-secondary mb-4">FlashNote is designed with HIPAA compliance in mind:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Patient data is processed but never stored</li>
                <li>All data transmission is encrypted (TLS 1.2+)</li>
                <li>Audit logs track all access (without PHI)</li>
                <li>We offer Business Associate Agreements (BAA) for covered entities</li>
              </ul>
            </Section>

            <Section title="Data Security">
              <p className="text-fn-text-secondary mb-4">
                We implement appropriate technical and organizational measures to protect your personal information, including:
              </p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Encryption in transit and at rest</li>
                <li>Regular security assessments</li>
                <li>Access controls and authentication</li>
                <li>Audit logging</li>
              </ul>
            </Section>

            <Section title="Data Retention">
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li><strong>Account data:</strong> Retained while your account is active</li>
                <li><strong>Usage logs:</strong> Retained for 6 years (HIPAA requirement)</li>
                <li><strong>Audit logs:</strong> Retained for 6 years (HIPAA requirement)</li>
              </ul>
            </Section>

            <Section title="Your Rights">
              <p className="text-fn-text-secondary mb-4">You have the right to:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your account</li>
                <li>Export your data</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </Section>

            <Section title="Third-Party Services">
              <p className="text-fn-text-secondary mb-4">We use the following third-party services:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li><strong>Google Gemini/Vertex AI:</strong> For AI processing (with BAA)</li>
                <li><strong>Stripe:</strong> For payment processing</li>
              </ul>
            </Section>

            <Section title="Changes to This Policy">
              <p className="text-fn-text-secondary">
                We may update this Privacy Policy from time to time. We will notify you of any changes
                by posting the new policy on this page and updating the &quot;Last Updated&quot; date.
              </p>
            </Section>

            <Section title="Contact Us">
              <p className="text-fn-text-secondary">
                If you have questions about this Privacy Policy, please contact us at:{' '}
                <a href="mailto:privacy@flashnote.com" className="link">privacy@flashnote.com</a>
              </p>
            </Section>
          </div>
        </article>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h3 className="text-xl font-semibold text-fn-text-primary mb-4">{title}</h3>
      {children}
    </section>
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
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-fn-text-inverse/70">
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-fn-text-inverse/70">
              <li>
                <a href="mailto:support@flashnote.com" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
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
