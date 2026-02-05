import Link from 'next/link';

/**
 * Landing Page V3 - Feature Showcase
 *
 * Strategy: Lead with detailed features and benefits.
 * Show the depth of the product with specific use cases,
 * feature breakdowns, and visual demonstrations.
 */
export default function LandingV3() {
  return (
    <div className="min-h-screen bg-fn-bg-primary">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-gradient">FlashNote</span>
            <span className="text-[9px] font-normal px-1.5 leading-4 rounded-full border border-stone-400 text-stone-400">BETA</span>
          </Link>
          <div className="hidden md:flex items-center space-x-6">
            <Link href="#features" className="text-fn-text-secondary hover:text-fn-text-primary transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-fn-text-secondary hover:text-fn-text-primary transition-colors">
              How It Works
            </Link>
            <Link href="/pricing" className="text-fn-text-secondary hover:text-fn-text-primary transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-fn-text-secondary hover:text-fn-text-primary transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary px-4 py-2">
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-6 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-fn-text-primary mb-6 leading-tight">
              The Complete SOAP Note Solution for
              <span className="text-gradient"> Physical Therapists</span>
            </h1>
            <p className="text-xl text-fn-text-secondary mb-8">
              AI-powered documentation that understands PT terminology, generates insurance-compliant
              notes, and works seamlessly with your existing workflow.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup" className="btn-primary px-8 py-4 text-lg text-center">
                Start 14-Day Free Trial
              </Link>
              <Link href="#demo" className="btn-secondary px-8 py-4 text-lg text-center">
                Watch Demo
              </Link>
            </div>
            <div className="flex items-center gap-6 mt-6 text-sm text-fn-text-muted">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No credit card
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                HIPAA compliant
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Cancel anytime
              </span>
            </div>
          </div>
          <div className="relative">
            {/* Product Preview */}
            <div className="card p-6 shadow-fn-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-fn-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-fn-amber-400 rounded-full"></div>
                <div className="w-3 h-3 bg-fn-emerald-400 rounded-full"></div>
                <span className="ml-2 text-sm text-fn-text-muted">FlashNote Extension</span>
              </div>
              <div className="bg-fn-bg-secondary rounded-fn-md p-4 mb-4">
                <div className="text-xs text-fn-text-muted mb-2">Your shorthand:</div>
                <div className="font-mono text-sm text-fn-text-primary">
                  pt c/o 6/10 LBP. AROM flex 45deg. TrP iliocostalis. grade II PA L3-4. HEP cat/camel 10x
                </div>
              </div>
              <div className="flex items-center gap-2 text-fn-emerald-600 text-sm mb-4">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Generating SOAP note...
              </div>
              <div className="bg-fn-emerald-50 border border-fn-emerald-200 rounded-fn-md p-4">
                <div className="text-xs text-fn-emerald-700 mb-2">Generated note:</div>
                <div className="text-sm text-fn-text-primary space-y-1">
                  <p><strong>S:</strong> Patient presents with complaints of 6/10 low back pain...</p>
                  <p><strong>O:</strong> Lumbar AROM flexion measured at 45°...</p>
                  <p className="text-fn-text-muted">+ 2 more sections</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="bg-fn-bg-secondary py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-fn-text-primary mb-4">
              Everything You Need, Nothing You Don&apos;t
            </h2>
            <p className="text-xl text-fn-text-secondary max-w-2xl mx-auto">
              FlashNote is purpose-built for physical therapy documentation—no bloat, no complexity,
              just the features that matter.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Feature 1 */}
            <div className="card p-8">
              <div className="w-14 h-14 bg-fn-emerald-100 rounded-fn-lg flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-3">Instant Generation</h3>
              <p className="text-fn-text-secondary mb-4">
                Get a complete, formatted SOAP note in under 30 seconds. Our AI processes your
                shorthand faster than you can type a greeting.
              </p>
              <ul className="space-y-2 text-sm text-fn-text-muted">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  &lt; 30 second generation
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No waiting or queues
                </li>
              </ul>
            </div>

            {/* Feature 2 */}
            <div className="card p-8">
              <div className="w-14 h-14 bg-fn-teal-100 rounded-fn-lg flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-fn-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-3">PT-Native AI</h3>
              <p className="text-fn-text-secondary mb-4">
                Unlike generic AI tools, FlashNote was trained specifically on physical therapy
                documentation. It knows your terminology.
              </p>
              <ul className="space-y-2 text-sm text-fn-text-muted">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Understands PT abbreviations
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Proper clinical language
                </li>
              </ul>
            </div>

            {/* Feature 3 */}
            <div className="card p-8">
              <div className="w-14 h-14 bg-fn-amber-100 rounded-fn-lg flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-fn-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-3">Insurance Ready</h3>
              <p className="text-fn-text-secondary mb-4">
                Notes are formatted to meet insurance documentation requirements. Reduce claim
                denials with thorough, compliant documentation.
              </p>
              <ul className="space-y-2 text-sm text-fn-text-muted">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Medical necessity language
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Functional goal documentation
                </li>
              </ul>
            </div>

            {/* Feature 4 */}
            <div className="card p-8">
              <div className="w-14 h-14 bg-fn-emerald-100 rounded-fn-lg flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-3">One-Click Copy</h3>
              <p className="text-fn-text-secondary mb-4">
                Copy your completed note with a single click and paste directly into any EMR.
                No exports, no file uploads, no friction.
              </p>
              <ul className="space-y-2 text-sm text-fn-text-muted">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Works with any EMR
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No integration setup
                </li>
              </ul>
            </div>

            {/* Feature 5 */}
            <div className="card p-8">
              <div className="w-14 h-14 bg-fn-teal-100 rounded-fn-lg flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-fn-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-3">HIPAA Compliant</h3>
              <p className="text-fn-text-secondary mb-4">
                Your patient data is never stored. Notes are processed in memory and immediately
                discarded. Bank-level encryption in transit.
              </p>
              <ul className="space-y-2 text-sm text-fn-text-muted">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Zero PHI storage
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  256-bit TLS encryption
                </li>
              </ul>
            </div>

            {/* Feature 6 */}
            <div className="card p-8">
              <div className="w-14 h-14 bg-fn-amber-100 rounded-fn-lg flex items-center justify-center mb-6">
                <svg className="w-7 h-7 text-fn-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-fn-text-primary mb-3">Chrome Extension</h3>
              <p className="text-fn-text-secondary mb-4">
                Access FlashNote right in your browser with our lightweight Chrome extension.
                Always one click away, no matter what EMR you use.
              </p>
              <ul className="space-y-2 text-sm text-fn-text-muted">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Lightweight &amp; fast
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-fn-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Works on any website
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Detailed */}
      <section id="how-it-works" className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-fn-text-primary mb-4">
            How FlashNote Works
          </h2>
          <p className="text-xl text-fn-text-secondary max-w-2xl mx-auto">
            Three simple steps to transform your documentation workflow
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          {/* Step 1 */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div className="order-2 md:order-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-fn-gradient-primary rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <h3 className="text-2xl font-semibold text-fn-text-primary">Type Your Shorthand</h3>
              </div>
              <p className="text-fn-text-secondary mb-4">
                Use the abbreviations you already know. FlashNote understands standard PT terminology
                and common shorthand patterns.
              </p>
              <div className="bg-fn-bg-secondary p-4 rounded-fn-lg">
                <div className="text-sm text-fn-text-muted mb-2">Examples FlashNote understands:</div>
                <ul className="text-sm text-fn-text-secondary space-y-1 font-mono">
                  <li>• ROM, AROM, PROM measurements</li>
                  <li>• Manual therapy: MFR, STM, grade I-V mobs</li>
                  <li>• Pain scales: VAS, NPRS, 0-10</li>
                  <li>• Common dx: LBP, neck pain, TKA, post-op</li>
                </ul>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="card p-6">
                <div className="text-sm text-fn-text-muted mb-2">Input:</div>
                <div className="bg-fn-bg-secondary p-4 rounded-fn-md font-mono text-sm text-fn-text-primary">
                  pt c/o 5/10 ant knee pain. squat ROM 90deg. PROM WNL. patellar mobs grade II. SLR 3x10. ice post-tx
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
            <div>
              <div className="card p-6 border-fn-emerald-200 bg-fn-emerald-50">
                <div className="flex items-center gap-2 text-fn-emerald-600 mb-4">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-semibold">AI Processing</span>
                </div>
                <div className="space-y-2 text-sm text-fn-text-secondary">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Parsing clinical shorthand
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Applying SOAP structure
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Adding clinical context
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Formatting for insurance
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-fn-gradient-primary rounded-full flex items-center justify-center text-white font-bold">
                  2
                </div>
                <h3 className="text-2xl font-semibold text-fn-text-primary">AI Generates Your Note</h3>
              </div>
              <p className="text-fn-text-secondary mb-4">
                Our PT-trained AI expands your shorthand into a complete, professionally formatted
                SOAP note in under 30 seconds.
              </p>
              <ul className="text-fn-text-secondary space-y-2">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Proper clinical terminology
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Complete SOAP sections
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-fn-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Insurance-ready language
                </li>
              </ul>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-fn-gradient-primary rounded-full flex items-center justify-center text-white font-bold">
                  3
                </div>
                <h3 className="text-2xl font-semibold text-fn-text-primary">Copy to Your EMR</h3>
              </div>
              <p className="text-fn-text-secondary mb-4">
                One click copies your note to clipboard. Paste it directly into WebPT, Net Health,
                Clinicient, or any other EMR. Done.
              </p>
              <div className="bg-fn-bg-secondary p-4 rounded-fn-lg">
                <div className="text-sm text-fn-text-muted mb-2">Compatible with:</div>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white rounded-full text-sm text-fn-text-secondary border border-fn-border-primary">WebPT</span>
                  <span className="px-3 py-1 bg-white rounded-full text-sm text-fn-text-secondary border border-fn-border-primary">Net Health</span>
                  <span className="px-3 py-1 bg-white rounded-full text-sm text-fn-text-secondary border border-fn-border-primary">Clinicient</span>
                  <span className="px-3 py-1 bg-white rounded-full text-sm text-fn-text-secondary border border-fn-border-primary">TheraOffice</span>
                  <span className="px-3 py-1 bg-white rounded-full text-sm text-fn-text-secondary border border-fn-border-primary">+ Any EMR</span>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-fn-text-muted">Generated SOAP Note</span>
                  <button className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                </div>
                <div className="bg-fn-bg-secondary p-4 rounded-fn-md text-sm text-fn-text-primary space-y-2">
                  <p><strong>SUBJECTIVE:</strong> Patient reports 5/10 anterior knee pain...</p>
                  <p><strong>OBJECTIVE:</strong> Squat ROM measured at 90 degrees...</p>
                  <p><strong>ASSESSMENT:</strong> Patient demonstrates functional limitations...</p>
                  <p><strong>PLAN:</strong> Continue current plan of care with focus on...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-fn-bg-secondary py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-fn-text-primary mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-fn-text-secondary">
              One plan. Unlimited notes. No hidden fees.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="card p-8 shadow-fn-xl border-2 border-fn-emerald-500">
              <div className="text-center">
                <div className="inline-block px-3 py-1 bg-fn-emerald-100 text-fn-emerald-700 rounded-full text-sm font-medium mb-4">
                  Most Popular
                </div>
                <div className="text-5xl font-bold text-gradient mb-2">
                  $29<span className="text-xl font-normal text-fn-text-muted">/month</span>
                </div>
                <p className="text-fn-text-secondary mb-6">Unlimited SOAP notes</p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Unlimited SOAP note generation
                </li>
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Chrome extension access
                </li>
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  HIPAA-compliant processing
                </li>
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Email support
                </li>
                <li className="flex items-center gap-3 text-fn-text-secondary">
                  <svg className="w-5 h-5 text-fn-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  14-day free trial
                </li>
              </ul>

              <Link href="/signup" className="btn-primary block w-full py-4 text-lg text-center">
                Start Free Trial
              </Link>
              <p className="text-center text-sm text-fn-text-muted mt-4">
                No credit card required
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-fn-text-primary mb-4">
          Ready to Transform Your Documentation?
        </h2>
        <p className="text-xl text-fn-text-secondary mb-8 max-w-2xl mx-auto">
          Join hundreds of physical therapists who&apos;ve reclaimed their time with FlashNote.
        </p>
        <Link href="/signup" className="btn-primary px-8 py-4 text-lg inline-block">
          Start Your Free 14-Day Trial
        </Link>
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
                <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
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
