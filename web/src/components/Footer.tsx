import Link from 'next/link';

export function Footer() {
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
            <p className="font-semibold text-white mb-4">Product</p>
            <ul className="space-y-2 text-sm text-fn-text-inverse/70">
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white mb-4">Support</p>
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
            <p className="font-semibold text-white mb-4">Legal</p>
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
              <li>
                <Link href="/baa" className="hover:text-white transition-colors">
                  BAA
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
