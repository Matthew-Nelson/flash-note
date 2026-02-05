import Link from 'next/link';

/**
 * Landing Page V2 - Problem-Agitation-Solution
 *
 * Strategy: Lead with the pain (late nights, documentation burden),
 * agitate it (show the cost), then present FlashNote as the solution.
 * Emotional storytelling approach.
 */
export default function LandingV2() {
  return (
    <div className="min-h-screen bg-fn-bg-primary">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient">FlashNote</span>
            <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
          </Link>
          <div className="flex items-center space-x-6">
            <Link href="/pricing" className="text-fn-text-secondary hover:text-fn-text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-fn-text-secondary hover:text-fn-text-primary transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary px-4 py-2">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero - The Problem */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-fn-text-primary mb-6 leading-tight">
            You didn&apos;t become a PT<br />
            <span className="text-fn-text-muted">to spend your nights writing notes.</span>
          </h1>
          <p className="text-xl text-fn-text-secondary mb-8">
            Yet here you are. It&apos;s 7 PM, your last patient left hours ago, and you&apos;re still
            staring at a screen typing up documentation. Sound familiar?
          </p>
        </div>
      </section>

      {/* Agitation - The Cost */}
      <section className="bg-fn-stone-50 py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-fn-text-primary mb-8 text-center">
              The hidden cost of documentation
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-fn-lg border border-fn-border-primary">
                <div className="text-4xl font-bold text-fn-red-500 mb-2">10+ hrs</div>
                <p className="text-fn-text-secondary">
                  Average time PTs spend on documentation weekly—time stolen from family, hobbies, rest.
                </p>
              </div>
              <div className="bg-white p-6 rounded-fn-lg border border-fn-border-primary">
                <div className="text-4xl font-bold text-fn-red-500 mb-2">62%</div>
                <p className="text-fn-text-secondary">
                  Of PTs report documentation as a primary source of burnout. It&apos;s the #1 reason therapists leave the profession.
                </p>
              </div>
              <div className="bg-white p-6 rounded-fn-lg border border-fn-border-primary">
                <div className="text-4xl font-bold text-fn-red-500 mb-2">$15K+</div>
                <p className="text-fn-text-secondary">
                  Lost annually in unbilled time spent on paperwork instead of patients or personal life.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transition - What If */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-fn-text-primary mb-6">
            What if documentation took<br />
            <span className="text-gradient">seconds instead of hours?</span>
          </h2>
          <p className="text-xl text-fn-text-secondary mb-8">
            Imagine finishing your notes before you finish your last patient. Walking out the door
            at 5 PM. Having your evenings back. That&apos;s FlashNote.
          </p>
        </div>
      </section>

      {/* Solution - FlashNote */}
      <section className="bg-fn-bg-secondary py-20">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-fn-text-primary mb-4">
                Meet FlashNote
              </h2>
              <p className="text-xl text-fn-text-secondary max-w-2xl mx-auto">
                AI that actually understands physical therapy. Type your shorthand, get a complete
                SOAP note. It&apos;s that simple.
              </p>
            </div>

            {/* Before/After Demo */}
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-fn-stone-200 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-fn-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-fn-text-primary">Before: 15 minutes of typing</span>
                </div>
                <div className="card p-6 bg-fn-stone-50">
                  <div className="font-mono text-sm text-fn-text-secondary leading-relaxed">
                    reports 40% pain reduction. flex ROM 50-&gt;65. MFR lumbar paraspinals.
                    grade III mobs L4-5. HEP bridges 2x15. tolerated well.
                  </div>
                  <div className="mt-4 text-sm text-fn-text-muted">
                    30 seconds to jot down
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-fn-emerald-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-fn-text-primary">After: Instant SOAP note</span>
                </div>
                <div className="card p-6 bg-fn-emerald-50 border-fn-emerald-200">
                  <div className="text-sm text-fn-text-primary space-y-2">
                    <p><strong>SUBJECTIVE:</strong> Patient reports approximately 40% reduction in low back pain since last visit...</p>
                    <p><strong>OBJECTIVE:</strong> Lumbar AROM: Flexion improved from 50° to 65°. Interventions: MFR to lumbar paraspinals...</p>
                    <p><strong>ASSESSMENT:</strong> Patient demonstrating good progress toward functional goals...</p>
                    <p><strong>PLAN:</strong> Continue current plan of care. HEP: bridging exercises 2x15...</p>
                  </div>
                  <div className="mt-4 text-sm text-fn-emerald-700 font-medium">
                    Ready in under 30 seconds
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why It Works */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-fn-text-primary mb-12">
            Built by PTs, for PTs
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-fn-gradient-primary rounded-fn-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-fn-text-primary mb-2">Speaks Your Language</h3>
                <p className="text-fn-text-secondary">
                  Our AI was trained on thousands of PT notes. It understands your abbreviations,
                  your workflow, your clinical reasoning.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-fn-gradient-primary rounded-fn-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-fn-text-primary mb-2">HIPAA Compliant</h3>
                <p className="text-fn-text-secondary">
                  We never store your patient data. Notes are processed and immediately discarded.
                  Your patients&apos; privacy is protected.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-fn-gradient-primary rounded-fn-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-fn-text-primary mb-2">Works With Any EMR</h3>
                <p className="text-fn-text-secondary">
                  WebPT, Net Health, Clinicient—doesn&apos;t matter. One click copy, paste into any system.
                  No complex integrations needed.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-fn-gradient-primary rounded-fn-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-fn-text-primary mb-2">Pays For Itself</h3>
                <p className="text-fn-text-secondary">
                  At $29/month, FlashNote costs less than the billable value of one 15-minute increment.
                  Save hours, pay pennies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial - Single Powerful */}
      <section className="bg-fn-gradient-primary py-16">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <svg className="w-12 h-12 text-white/30 mx-auto mb-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
            <blockquote className="text-2xl md:text-3xl text-white font-medium mb-8 leading-relaxed">
              &ldquo;I was ready to leave the profession. The paperwork was crushing me.
              FlashNote didn&apos;t just save me time—it saved my career.&rdquo;
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                AR
              </div>
              <div className="text-left">
                <div className="font-semibold text-white">Amanda R., DPT</div>
                <div className="text-white/70">Outpatient Orthopedics, 6 years</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Pricing */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-fn-text-primary mb-4">
            Get Your Evenings Back
          </h2>
          <p className="text-xl text-fn-text-secondary mb-8">
            Start free. No credit card required. Cancel anytime.
          </p>
          <div className="card p-8 shadow-fn-lg">
            <div className="text-5xl font-bold text-gradient mb-2">
              $29<span className="text-xl font-normal text-fn-text-muted">/month</span>
            </div>
            <p className="text-fn-text-secondary mb-6">Unlimited SOAP notes</p>
            <ul className="text-left space-y-3 mb-8">
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                14-day free trial
              </li>
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Works with any EMR
              </li>
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                HIPAA compliant
              </li>
              <li className="flex items-center gap-3 text-fn-text-secondary">
                <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                30-day money-back guarantee
              </li>
            </ul>
            <Link href="/signup" className="btn-primary block w-full py-4 text-lg">
              Start Your Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-fn-bg-secondary py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-fn-text-primary mb-4">
            Ready to stop working overtime?
          </h2>
          <p className="text-fn-text-secondary mb-6">
            Join hundreds of PTs who&apos;ve reclaimed their time.
          </p>
          <Link href="/signup" className="btn-primary px-8 py-4 text-lg inline-block">
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-fn-bg-inverse text-fn-text-inverse py-12">
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
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="#demo" className="hover:text-white transition-colors">Demo</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-fn-text-inverse/70">
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><a href="mailto:support@flashnote.com" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-fn-text-inverse/70">
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-fn-text-inverse/20 mt-8 pt-8 text-sm text-center text-fn-text-inverse/70">
            &copy; {new Date().getFullYear()} FlashNote. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
