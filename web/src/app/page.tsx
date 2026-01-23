import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-primary-600">FlashNote</div>
          <div className="flex items-center space-x-6">
            <Link
              href="/pricing"
              className="text-gray-600 hover:text-gray-900"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Write PT Notes in Seconds,
          <br />
          <span className="text-primary-600">Not Hours</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          FlashNote uses AI to transform your shorthand notes into complete,
          insurance-compliant SOAP documentation. Works with any EMR.
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            href="/signup"
            className="px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700"
          >
            Start Free Trial
          </Link>
          <Link
            href="#demo"
            className="px-8 py-4 border border-gray-300 text-gray-700 text-lg font-semibold rounded-lg hover:bg-gray-50"
          >
            See Demo
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-4">
          14-day free trial. No credit card required.
        </p>
      </section>

      {/* How It Works */}
      <section id="demo" className="container mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-600">1</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Type Shorthand</h3>
            <p className="text-gray-600">
              Enter your quick notes using familiar PT abbreviations
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-600">2</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Generates</h3>
            <p className="text-gray-600">
              Our AI expands your notes into a complete SOAP format
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-primary-600">3</span>
            </div>
            <h3 className="text-xl font-semibold mb-2">Copy to EMR</h3>
            <p className="text-gray-600">
              One click to copy the note into your documentation system
            </p>
          </div>
        </div>
      </section>

      {/* Example */}
      <section className="bg-gray-50 py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            See the Difference
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4">You Type:</h3>
              <div className="bg-gray-50 p-4 rounded text-sm font-mono text-gray-800">
                reports 40% pain reduction. flex ROM 50-&gt;65. MFR lumbar
                paraspinals. grade III mobs L4-5. HEP bridges 2x15. tolerated
                well.
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-4">You Get:</h3>
              <div className="bg-gray-50 p-4 rounded text-sm text-gray-800 space-y-2">
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
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Simple, Affordable Pricing
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Save hours every week for less than a coffee per day
        </p>
        <div className="inline-block bg-white p-8 rounded-lg shadow-lg">
          <div className="text-5xl font-bold text-gray-900">
            $29<span className="text-xl font-normal text-gray-500">/month</span>
          </div>
          <p className="text-gray-600 mt-2">Unlimited SOAP notes</p>
          <Link
            href="/signup"
            className="inline-block mt-6 px-8 py-3 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-700"
          >
            Start Free Trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-xl font-bold text-white mb-4">FlashNote</div>
              <p className="text-sm">
                AI-powered documentation for physical therapists.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/pricing" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="#demo" className="hover:text-white">
                    Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/help" className="hover:text-white">
                    Help Center
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@flashnote.com" className="hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/privacy" className="hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
            &copy; {new Date().getFullYear()} FlashNote. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
