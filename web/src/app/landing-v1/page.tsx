import Link from 'next/link';

/**
 * Landing Page V1 - Social Proof & Trust Heavy
 *
 * Strategy: Lead with credibility signals - testimonials, statistics,
 * clinic logos, and trust badges to establish authority and reduce risk perception.
 */
export default function LandingV1() {
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

      {/* Hero with Stats */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-fn-emerald-50 text-fn-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-fn-emerald-500 rounded-full animate-pulse"></span>
            Trusted by 500+ Physical Therapists
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-fn-text-primary mb-6 leading-tight">
            The Documentation Tool<br />
            <span className="text-gradient">PTs Actually Love</span>
          </h1>

          <p className="text-xl text-fn-text-secondary mb-8 max-w-2xl mx-auto">
            Join hundreds of physical therapists who&apos;ve reclaimed 5+ hours every week.
            Turn shorthand into insurance-compliant SOAP notes in seconds.
          </p>

          {/* Trust Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto mb-10">
            <div>
              <div className="text-4xl font-bold text-gradient">5+ hrs</div>
              <div className="text-fn-text-muted text-sm">Saved weekly</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient">30 sec</div>
              <div className="text-fn-text-muted text-sm">Per note</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-gradient">100%</div>
              <div className="text-fn-text-muted text-sm">HIPAA compliant</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/signup" className="btn-primary px-8 py-4 text-lg">
              Start Your Free Trial
            </Link>
            <Link href="#testimonials" className="btn-secondary px-8 py-4 text-lg">
              Read Success Stories
            </Link>
          </div>

          <p className="text-sm text-fn-text-muted mt-4">
            No credit card required • Cancel anytime • HIPAA compliant
          </p>
        </div>
      </section>

      {/* Social Proof - Clinic Logos */}
      <section className="border-y border-fn-border-primary bg-fn-bg-secondary py-10">
        <div className="container mx-auto px-6">
          <p className="text-center text-fn-text-muted text-sm mb-6 uppercase tracking-wider">
            Trusted by clinics across the country
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            <div className="text-xl font-semibold text-fn-text-secondary">Peak Performance PT</div>
            <div className="text-xl font-semibold text-fn-text-secondary">Atlas Physical Therapy</div>
            <div className="text-xl font-semibold text-fn-text-secondary">Movement Matters</div>
            <div className="text-xl font-semibold text-fn-text-secondary">Restore PT & Wellness</div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-fn-text-primary mb-4">
          PTs Love FlashNote
        </h2>
        <p className="text-center text-fn-text-secondary mb-12 max-w-xl mx-auto">
          Don&apos;t just take our word for it. Here&apos;s what physical therapists are saying.
        </p>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="card p-6">
            <div className="flex items-center gap-1 text-fn-amber-500 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-fn-text-secondary mb-4">
              &ldquo;I used to spend 2 hours every night on notes. Now I&apos;m done before I leave the clinic.
              FlashNote gave me my evenings back.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-fn-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                SK
              </div>
              <div>
                <div className="font-semibold text-fn-text-primary">Sarah K., DPT</div>
                <div className="text-sm text-fn-text-muted">Outpatient Ortho • 8 years</div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-1 text-fn-amber-500 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-fn-text-secondary mb-4">
              &ldquo;The AI actually understands PT terminology. No other tool has gotten our shorthand right.
              It&apos;s like it was built by someone who&apos;s actually worked in a clinic.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-fn-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                MR
              </div>
              <div>
                <div className="font-semibold text-fn-text-primary">Marcus R., PT</div>
                <div className="text-sm text-fn-text-muted">Sports Rehab • 12 years</div>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-1 text-fn-amber-500 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-5 h-5 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-fn-text-secondary mb-4">
              &ldquo;As a clinic owner, I was skeptical of AI documentation. But the notes are thorough,
              insurance-ready, and my team loves it. ROI was instant.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-fn-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                JT
              </div>
              <div>
                <div className="font-semibold text-fn-text-primary">Jennifer T., DPT</div>
                <div className="text-sm text-fn-text-muted">Clinic Owner • 15 years</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Brief */}
      <section className="bg-fn-bg-secondary py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-fn-text-primary mb-12">
            Simple as 1-2-3
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-fn-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-2">Type Your Way</h3>
              <p className="text-fn-text-secondary">
                Use your normal shorthand. FlashNote speaks PT.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-fn-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-2">AI Does the Rest</h3>
              <p className="text-fn-text-secondary">
                Complete SOAP note generated in under 30 seconds.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-fn-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-2">Copy & Done</h3>
              <p className="text-fn-text-secondary">
                One click to paste into any EMR. That&apos;s it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="container mx-auto px-6 py-16">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-fn-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="font-semibold text-fn-text-primary">HIPAA Compliant</div>
            <div className="text-sm text-fn-text-muted">SOC 2 Type II</div>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-fn-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="font-semibold text-fn-text-primary">Bank-Level Security</div>
            <div className="text-sm text-fn-text-muted">256-bit encryption</div>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-fn-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="font-semibold text-fn-text-primary">No PHI Stored</div>
            <div className="text-sm text-fn-text-muted">Pass-through only</div>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-fn-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <svg className="w-8 h-8 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="font-semibold text-fn-text-primary">Money-Back Guarantee</div>
            <div className="text-sm text-fn-text-muted">30-day no questions</div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-fn-gradient-primary py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Join 500+ PTs Who&apos;ve Made the Switch
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-xl mx-auto">
            Start your free trial today. No credit card required.
          </p>
          <Link href="/signup" className="inline-block bg-white text-fn-emerald-600 font-semibold px-8 py-4 rounded-fn-lg text-lg hover:bg-fn-cream-50 transition-colors">
            Start Free 14-Day Trial
          </Link>
          <p className="text-sm text-white/60 mt-4">
            Then just $29/month for unlimited notes
          </p>
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
                <li><Link href="#testimonials" className="hover:text-white transition-colors">Testimonials</Link></li>
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
