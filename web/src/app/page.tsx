import Link from 'next/link';
import { MarketingNav } from '@/components/MarketingNav';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-fn-bg-primary">
      <MarketingNav />

      <main id="main-content" tabIndex={-1}>
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-fn-text-primary mb-6">
            Write PT Notes in Seconds,
            <br />
            <span className="text-fn-primary">Not Hours</span>
          </h1>
          <p className="text-xl text-fn-text-secondary mb-8 max-w-2xl mx-auto">
            FlashNote uses AI to transform your shorthand notes into complete,
            insurance-compliant SOAP documentation. Works with any EMR.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="btn-primary px-8 py-4 text-lg"
            >
              Start Free Trial
            </Link>
            <Link
              href="#demo"
              className="btn-secondary px-8 py-4 text-lg"
            >
              See Demo
            </Link>
          </div>
          <p className="text-sm text-fn-text-secondary mt-4">
            14-day free trial. No credit card required.
          </p>
        </section>

        {/* How It Works */}
        <section id="demo" className="container mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center text-fn-text-primary mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-fn-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-2">Type Shorthand</h3>
              <p className="text-fn-text-secondary">
                Enter your quick notes using familiar PT abbreviations
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-fn-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-2">AI Generates</h3>
              <p className="text-fn-text-secondary">
                Our AI expands your notes into a complete SOAP format
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-fn-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-2">Copy to EMR</h3>
              <p className="text-fn-text-secondary">
                One click to copy the note into your documentation system
              </p>
            </div>
          </div>
        </section>

        {/* Trust Signals */}
        <section className="container mx-auto px-6 py-12">
          <div className="flex flex-wrap justify-center gap-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-2 text-fn-text-secondary">
              <svg aria-hidden="true" className="w-5 h-5 text-fn-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm font-medium">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2 text-fn-text-secondary">
              <svg aria-hidden="true" className="w-5 h-5 text-fn-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm font-medium">Built for Physical Therapists</span>
            </div>
            <div className="flex items-center gap-2 text-fn-text-secondary">
              <svg aria-hidden="true" className="w-5 h-5 text-fn-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm font-medium">256-bit Encryption</span>
            </div>
          </div>
        </section>

        {/* See the Difference */}
        <section className="bg-fn-bg-secondary py-20">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-fn-text-primary mb-12">
              See the Difference
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="card p-6">
                <h3 className="font-semibold text-fn-text-primary mb-4">You Type:</h3>
                <div className="bg-fn-bg-secondary p-4 rounded-fn-md text-sm font-mono text-fn-text-primary">
                  reports 40% pain reduction. flex ROM 50-&gt;65. MFR lumbar
                  paraspinals. grade III mobs L4-5. HEP bridges 2x15. tolerated
                  well.
                </div>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold text-fn-text-primary mb-4">You Get:</h3>
                <div className="bg-fn-bg-secondary p-4 rounded-fn-md text-sm text-fn-text-primary space-y-2">
                  <p>
                    <strong className="text-fn-soap-subjective">SUBJECTIVE:</strong> Patient reports approximately 40%
                    reduction in low back pain...
                  </p>
                  <p>
                    <strong className="text-fn-soap-objective">OBJECTIVE:</strong> Lumbar AROM: Flexion improved from
                    50° to 65°...
                  </p>
                  <p>
                    <strong className="text-fn-soap-assessment">ASSESSMENT:</strong> Patient demonstrating good
                    progress toward functional goals...
                  </p>
                  <p>
                    <strong className="text-fn-soap-plan">PLAN:</strong> Continue current plan of care...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Placeholder */}
        <section className="container mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center text-fn-text-primary mb-12">
            What Therapists Are Saying
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-fn-bg-secondary mx-auto mb-4" aria-hidden="true" />
                <p className="text-fn-text-secondary italic mb-4">
                  &ldquo;Testimonials from beta testers coming soon.&rdquo;
                </p>
                <p className="text-fn-sm text-fn-text-secondary">Beta Tester</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Preview */}
        <section className="container mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-fn-text-primary mb-4">
            Simple, Affordable Pricing
          </h2>
          <p className="text-xl text-fn-text-secondary mb-8">
            Save hours every week for less than a coffee per day
          </p>
          <div className="inline-block card p-8 shadow-fn-lg">
            <div className="text-5xl font-bold text-fn-primary">
              $29<span className="text-xl font-normal text-fn-text-secondary">/month</span>
            </div>
            <p className="text-fn-text-secondary mt-2">Unlimited SOAP notes</p>
            <Link
              href="/signup"
              className="btn-primary inline-block mt-6 px-8 py-3"
            >
              Start Free Trial
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
