import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service | FlashNote',
  description: 'FlashNote Terms of Service - Read our terms and conditions for using our service.',
};

export default function TermsOfServicePage() {
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
          <h1 className="text-4xl font-bold text-fn-text-primary mb-2">Terms of Service</h1>
          <p className="text-fn-text-muted mb-8">Last Updated: February 2026</p>

          <div className="prose prose-slate max-w-none">
            <p className="text-fn-text-secondary text-lg mb-8">
              Welcome to FlashNote. Please read these Terms of Service (&quot;Terms&quot;) carefully
              before using our services.
            </p>

            <Section title="1. Acceptance of Terms">
              <p className="text-fn-text-secondary">
                By accessing or using FlashNote, you agree to be bound by these Terms.
                If you disagree with any part of the terms, you may not access the service.
              </p>
            </Section>

            <Section title="2. Description of Service">
              <p className="text-fn-text-secondary mb-4">
                FlashNote is an AI-powered documentation tool that helps physical therapists
                generate SOAP notes from shorthand input. The service includes:
              </p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Browser extension for note generation</li>
                <li>Account management dashboard</li>
                <li>Related documentation and support</li>
              </ul>
            </Section>

            <Section title="3. User Accounts">
              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Registration</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1 mb-4">
                <li>You must provide accurate and complete information</li>
                <li>You are responsible for maintaining the security of your account</li>
                <li>You must be a licensed healthcare professional or working under supervision of one</li>
              </ul>

              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Account Security</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>You are responsible for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access</li>
                <li>We reserve the right to disable accounts that violate these terms</li>
              </ul>
            </Section>

            <Section title="4. Subscription and Payment">
              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Pricing</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1 mb-4">
                <li>Current pricing is available on our <Link href="/pricing" className="link">pricing page</Link></li>
                <li>Prices may change with 30 days notice</li>
              </ul>

              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Billing</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1 mb-4">
                <li>Subscriptions are billed in advance on a monthly or annual basis</li>
                <li>Payment is processed securely through Stripe</li>
              </ul>

              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Free Trial</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1 mb-4">
                <li>New users receive a 14-day free trial</li>
                <li>No credit card required for trial</li>
                <li>Trial automatically ends after 14 days</li>
              </ul>

              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Cancellation</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1 mb-4">
                <li>You may cancel your subscription at any time through your account dashboard</li>
                <li>Access continues until the end of your current billing period</li>
                <li>Cancellation takes effect at the end of the billing period; no partial refunds are provided</li>
              </ul>

              <h4 className="text-lg font-semibold text-fn-text-primary mt-4 mb-2">Refund Policy</h4>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li><strong>Monthly subscriptions:</strong> No refunds for partial billing periods. You retain access until the end of your current billing cycle.</li>
                <li><strong>Annual subscriptions:</strong> You may request a pro-rata refund within the first 30 days of your subscription or renewal. After 30 days, no refunds are provided, but you retain access for the remainder of your annual term.</li>
                <li><strong>Exceptions:</strong> Refunds are not available for accounts terminated due to Terms of Service violations.</li>
                <li><strong>How to request a refund:</strong> Contact us at <a href="mailto:support@flashnote.co" className="link">support@flashnote.co</a> with your account email and reason for the request. Approved refunds are processed within 5-10 business days.</li>
              </ul>
            </Section>

            <Section title="5. Acceptable Use">
              <p className="text-fn-text-secondary mb-4">You agree NOT to:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Use the service for any unlawful purpose</li>
                <li>Attempt to gain unauthorized access to our systems</li>
                <li>Transmit malware or malicious code</li>
                <li>Interfere with other users&apos; access to the service</li>
                <li>Reverse engineer or decompile the software</li>
                <li>Resell or redistribute the service without permission</li>
              </ul>
            </Section>

            <Section title="6. Healthcare Disclaimer">
              <div className="bg-fn-bg-secondary border border-fn-border-color rounded-fn-md p-4 mb-4">
                <p className="text-fn-text-primary font-semibold mb-2">IMPORTANT:</p>
                <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                  <li>FlashNote is a documentation assistance tool, not a medical device</li>
                  <li>All generated notes must be reviewed by a licensed professional</li>
                  <li>You are responsible for the accuracy and completeness of your documentation</li>
                  <li>FlashNote does not provide medical advice or diagnoses</li>
                </ul>
              </div>
            </Section>

            <Section title="7. Intellectual Property">
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>FlashNote and its original content are protected by copyright</li>
                <li>You retain ownership of the content you create</li>
                <li>You grant us a license to process your input to provide the service</li>
              </ul>
            </Section>

            <Section title="8. Limitation of Liability">
              <p className="text-fn-text-secondary mb-4 font-semibold">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>FlashNote is provided &quot;as is&quot; without warranties</li>
                <li>We are not liable for indirect, incidental, or consequential damages</li>
                <li>Our total liability is limited to the amount paid for the service</li>
              </ul>
            </Section>

            <Section title="9. HIPAA, HITECH Act, and Data Security">
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>FlashNote operates as a Business Associate under HIPAA and the HITECH Act of 2009</li>
                <li>We maintain administrative, physical, and technical safeguards for Protected Health Information as required by the HIPAA Security Rule, as strengthened by the HITECH Act</li>
                <li>We provide Business Associate Agreements (BAA) to covered entities as required by HIPAA and the HITECH Act &mdash; acceptance of a BAA is required to use FlashNote</li>
                <li>We comply with the HITECH Act Breach Notification Rule and will notify covered entities of any breach of unsecured PHI within 72 hours of discovery</li>
                <li>We maintain BAAs with all subprocessors who handle PHI on our behalf</li>
                <li>See our <Link href="/privacy" className="link">Privacy Policy</Link> for details on data handling</li>
              </ul>
            </Section>

            <Section title="10. Modifications to Service">
              <p className="text-fn-text-secondary mb-4">We reserve the right to:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Modify or discontinue features with reasonable notice</li>
                <li>Update these Terms at any time</li>
                <li>Change pricing with 30 days notice</li>
              </ul>
            </Section>

            <Section title="11. Termination">
              <p className="text-fn-text-secondary mb-4">We may terminate or suspend your account for:</p>
              <ul className="list-disc list-inside text-fn-text-secondary space-y-1">
                <li>Violation of these Terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment</li>
                <li>Extended inactivity</li>
              </ul>
            </Section>

            <Section title="12. Governing Law">
              <p className="text-fn-text-secondary">
                These Terms are governed by the laws of the State of California, United States,
                without regard to conflict of law provisions.
              </p>
            </Section>

            <Section title="13. Contact Information">
              <p className="text-fn-text-secondary">
                For questions about these Terms, please contact us at:{' '}
                <a href="mailto:legal@flashnote.co" className="link">legal@flashnote.co</a>
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
                <a href="mailto:support@flashnote.co" className="hover:text-white transition-colors">
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
