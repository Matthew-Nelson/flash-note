import Link from 'next/link';

/**
 * Landing Page V4 - Minimalist Bold Typography
 *
 * Strategy: Apple-inspired design with massive typography,
 * generous whitespace, and focused messaging. Let the
 * design breathe and the words do the selling.
 */
export default function LandingV4() {
  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-50 border-b border-stone-100">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-semibold text-stone-900">
              FlashNote
            </Link>
            <div className="flex items-center space-x-8">
              <Link href="/pricing" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                Pricing
              </Link>
              <Link href="/login" className="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                Sign In
              </Link>
              <Link href="/signup" className="text-sm bg-stone-900 text-white px-4 py-2 rounded-full hover:bg-stone-800 transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero - Giant Typography */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-stone-900 leading-[0.95] tracking-tight mb-8">
              Documentation.<br />
              <span className="text-stone-400">Simplified.</span>
            </h1>
            <p className="text-xl md:text-2xl text-stone-500 max-w-2xl mb-12 leading-relaxed">
              Type shorthand. Get complete SOAP notes. Save hours every week.
              Built for physical therapists who value their time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center bg-stone-900 text-white text-lg px-8 py-4 rounded-full hover:bg-stone-800 transition-colors"
              >
                Try Free for 14 Days
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center justify-center border border-stone-300 text-stone-700 text-lg px-8 py-4 rounded-full hover:border-stone-400 transition-colors"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Statement Section */}
      <section className="py-20 md:py-32 bg-stone-50">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-3xl md:text-4xl lg:text-5xl font-medium text-stone-900 leading-tight">
              The average PT spends <span className="text-emerald-600">10+ hours</span> weekly
              on documentation. FlashNote cuts that to <span className="text-emerald-600">minutes</span>.
            </p>
          </div>
        </div>
      </section>

      {/* Visual Demo */}
      <section id="how" className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-sm font-medium text-stone-400 uppercase tracking-wider mb-4">
                How It Works
              </h2>
              <p className="text-3xl md:text-4xl font-bold text-stone-900">
                Three seconds to understand.<br />
                Thirty seconds to a complete note.
              </p>
            </div>

            {/* Before/After - Clean */}
            <div className="grid md:grid-cols-2 gap-1 bg-stone-200 rounded-3xl overflow-hidden">
              <div className="bg-white p-8 md:p-12">
                <div className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-6">
                  You type
                </div>
                <div className="font-mono text-lg md:text-xl text-stone-700 leading-relaxed">
                  pt reports 6/10 LBP improved from 8/10. AROM flex 55deg, ext 20deg. MFR QL bilat.
                  grade III PA L4-5. HEP piriformis stretch 3x30s. good tolerance.
                </div>
              </div>
              <div className="bg-stone-900 p-8 md:p-12">
                <div className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-6">
                  You get
                </div>
                <div className="text-lg md:text-xl text-stone-300 leading-relaxed space-y-4">
                  <p>
                    <span className="text-white font-semibold">SUBJECTIVE:</span> Patient reports
                    improvement in low back pain from 8/10 to 6/10 on the numeric pain rating scale...
                  </p>
                  <p>
                    <span className="text-white font-semibold">OBJECTIVE:</span> Lumbar AROM:
                    Flexion 55°, Extension 20°. Manual therapy interventions included...
                  </p>
                  <p className="text-stone-500">
                    + Assessment &amp; Plan sections
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features - Minimal Cards */}
      <section className="py-20 md:py-32 bg-stone-50">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-8">
                <div className="text-4xl mb-6">⚡</div>
                <h3 className="text-xl font-semibold text-stone-900 mb-3">Instant</h3>
                <p className="text-stone-600 leading-relaxed">
                  Complete SOAP notes generated in under 30 seconds. No waiting, no queues.
                </p>
              </div>
              <div className="p-8">
                <div className="text-4xl mb-6">🔒</div>
                <h3 className="text-xl font-semibold text-stone-900 mb-3">Secure</h3>
                <p className="text-stone-600 leading-relaxed">
                  HIPAA compliant. Zero PHI storage. Bank-level encryption. Your patients are protected.
                </p>
              </div>
              <div className="p-8">
                <div className="text-4xl mb-6">🎯</div>
                <h3 className="text-xl font-semibold text-stone-900 mb-3">PT-Native</h3>
                <p className="text-stone-600 leading-relaxed">
                  Built specifically for physical therapy. Understands your terminology and workflow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Big Quote */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <blockquote className="text-2xl md:text-3xl lg:text-4xl font-medium text-stone-900 leading-relaxed mb-8">
              &ldquo;I leave work on time now. That&apos;s it. That&apos;s the review.&rdquo;
            </blockquote>
            <div className="text-stone-500">
              <span className="font-medium text-stone-700">Dr. Sarah Chen, DPT</span>
              <span className="mx-2">·</span>
              Outpatient Orthopedics
            </div>
          </div>
        </div>
      </section>

      {/* Pricing - Clean */}
      <section className="py-20 md:py-32 bg-stone-900">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-4">
              Pricing
            </h2>
            <div className="text-6xl md:text-8xl font-bold text-white mb-4">
              $29
            </div>
            <p className="text-xl text-stone-400 mb-8">
              per month · unlimited notes
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-stone-400 mb-12">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                14-day free trial
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No credit card required
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cancel anytime
              </span>
            </div>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-white text-stone-900 text-lg px-8 py-4 rounded-full hover:bg-stone-100 transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ - Minimal */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-stone-900 mb-12 text-center">
              Questions
            </h2>
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  Does it work with my EMR?
                </h3>
                <p className="text-stone-600">
                  Yes. FlashNote generates text you copy and paste into any system—WebPT, Net Health,
                  Clinicient, or any other EMR. No integrations needed.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  Is my patient data safe?
                </h3>
                <p className="text-stone-600">
                  Absolutely. We never store patient data. Notes are processed in memory with bank-level
                  encryption and immediately discarded. We&apos;re fully HIPAA compliant.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  What if the AI gets something wrong?
                </h3>
                <p className="text-stone-600">
                  You always review and edit before copying. FlashNote handles the heavy lifting,
                  you maintain clinical oversight. Just like dictation, but faster.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-900 mb-2">
                  How does the free trial work?
                </h3>
                <p className="text-stone-600">
                  14 days of unlimited access, no credit card required. Use it as much as you want.
                  If it saves you time, keep it. If not, no hard feelings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 md:py-32 bg-stone-50">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-6">
              Ready to leave work on time?
            </h2>
            <p className="text-xl text-stone-600 mb-8">
              Start your free trial today.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-stone-900 text-white text-lg px-8 py-4 rounded-full hover:bg-stone-800 transition-colors"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="py-12 border-t border-stone-200">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-stone-500 text-sm">
              &copy; {new Date().getFullYear()} FlashNote. All rights reserved.
            </div>
            <div className="flex items-center gap-8 text-sm text-stone-500">
              <Link href="/privacy" className="hover:text-stone-900 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-stone-900 transition-colors">Terms</Link>
              <a href="mailto:support@flashnote.com" className="hover:text-stone-900 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
