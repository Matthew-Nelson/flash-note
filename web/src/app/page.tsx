import Link from 'next/link';

export default function Home() {
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

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-fn-text-primary mb-6">
          Write PT Notes in Seconds,
          <br />
          <span className="text-gradient">Not Hours</span>
        </h1>
        <p className="text-xl text-fn-text-secondary mb-8 max-w-2xl mx-auto">
          FlashNote uses AI to transform your shorthand notes into complete,
          insurance-compliant SOAP documentation. Works with any EMR.
        </p>
        <div className="flex justify-center space-x-4">
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
        <p className="text-sm text-fn-text-muted mt-4">
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
            <div className="w-16 h-16 bg-fn-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">1</span>
            </div>
            <h3 className="text-xl font-semibold text-fn-text-primary mb-2">Type Shorthand</h3>
            <p className="text-fn-text-secondary">
              Enter your quick notes using familiar PT abbreviations
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-fn-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">2</span>
            </div>
            <h3 className="text-xl font-semibold text-fn-text-primary mb-2">AI Generates</h3>
            <p className="text-fn-text-secondary">
              Our AI expands your notes into a complete SOAP format
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-fn-gradient-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-white">3</span>
            </div>
            <h3 className="text-xl font-semibold text-fn-text-primary mb-2">Copy to EMR</h3>
            <p className="text-fn-text-secondary">
              One click to copy the note into your documentation system
            </p>
          </div>
        </div>
      </section>

      {/* Example */}
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
                  <strong>SUBJECTIVE:</strong> Patient reports approximately 40%
                  reduction in low back pain...
                </p>
                <p>
                  <strong>OBJECTIVE:</strong> Lumbar AROM: Flexion improved from
                  50° to 65°...
                </p>
                <p>
                  <strong>ASSESSMENT:</strong> Patient demonstrating good
                  progress toward functional goals...
                </p>
                <p>
                  <strong>PLAN:</strong> Continue current plan of care...
                </p>
              </div>
            </div>
          </div>
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
          <div className="text-5xl font-bold text-gradient">
            $29<span className="text-xl font-normal text-fn-text-muted">/month</span>
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
                <li>
                  <Link href="/pricing" className="hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#demo" className="hover:text-white transition-colors">
                    Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-fn-text-inverse/70">
                <li>
                  <Link href="/help" className="hover:text-white transition-colors">
                    Help Center
                  </Link>
                </li>
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
    </div>
  );
}
