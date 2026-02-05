'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Landing Page V5 - Demo-First Interactive
 *
 * Strategy: Lead with an interactive demo that lets users
 * experience the product immediately. Show, don't tell.
 * The product sells itself.
 */

const exampleInputs = [
  {
    label: 'Orthopedic',
    shorthand: 'pt c/o 5/10 ant knee pain. squat ROM 85deg limited by pain. patellar mobs grade II. quad sets 3x15. ice 10min. tol well.',
    output: {
      s: 'Patient reports anterior knee pain rated 5/10 on numeric pain rating scale, aggravated with squatting activities.',
      o: 'Squat ROM limited to 85° secondary to pain complaints. Interventions: Grade II patellar mobilizations performed to improve patellar tracking. Therapeutic exercise: quad sets 3 sets x 15 repetitions. Cryotherapy applied for 10 minutes post-treatment. Patient tolerated all interventions well without adverse reaction.',
      a: 'Patient demonstrates functional limitations with squatting activities due to anterior knee pain. Responding appropriately to manual therapy and therapeutic exercise interventions.',
      p: 'Continue current plan of care with focus on patellar mobility and quadriceps strengthening. Progress exercises as tolerated. Follow up next session.',
    },
  },
  {
    label: 'Spine',
    shorthand: 'reports 40% pain reduction. flex ROM 50->65deg. MFR lumbar paraspinals bilat. grade III PA mobs L4-5. HEP bridges 2x15. good progress.',
    output: {
      s: 'Patient reports approximately 40% reduction in low back pain since initial evaluation, describing steady improvement with current plan of care.',
      o: 'Lumbar AROM: Flexion improved from 50° to 65° since last visit. Interventions: Myofascial release performed to bilateral lumbar paraspinals. Grade III posterior-anterior mobilizations to L4-5 segment. Home exercise program reviewed: bridging exercises 2 sets x 15 repetitions.',
      a: 'Patient demonstrating good progress toward functional goals with measurable improvements in lumbar flexion ROM and reported pain reduction. Responding well to manual therapy interventions.',
      p: 'Continue current plan of care. Progress mobilization grades as tissue tolerance allows. Advance HEP with additional core stabilization exercises. Re-assess in 2 visits.',
    },
  },
  {
    label: 'Post-Op',
    shorthand: 'POD 10 R TKA. reports 3/10 incision pain. AROM flex 95deg ext -5deg. patellar mobs grade I. NMES quads. gait 50ft x2 FWW. HEP reviewed.',
    output: {
      s: 'Patient is post-operative day 10 following right total knee arthroplasty. Reports incisional pain rated 3/10 at rest, manageable with current pain management protocol.',
      o: 'Right knee AROM: Flexion 95°, Extension -5° (lacking 5° of full extension). Interventions: Grade I patellar mobilizations performed. Neuromuscular electrical stimulation applied to right quadriceps for muscle re-education. Gait training: ambulated 50 feet x 2 trials with front-wheeled walker, demonstrating improved weight acceptance. Home exercise program reviewed and updated.',
      a: 'Patient progressing appropriately for POD 10 status post R TKA. ROM within expected parameters. Quadriceps activation improving with NMES. Gait pattern improving with assistive device.',
      p: 'Continue current post-operative rehabilitation protocol. Focus on achieving full knee extension and improving quadriceps strength. Progress gait training and assistive device as appropriate. Follow standard TKA pathway.',
    },
  },
];

export default function LandingV5() {
  const [selectedExample, setSelectedExample] = useState(0);
  const [showOutput, setShowOutput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setShowOutput(false);
    setTimeout(() => {
      setIsGenerating(false);
      setShowOutput(true);
    }, 1500);
  };

  const handleExampleChange = (index: number) => {
    setSelectedExample(index);
    setShowOutput(false);
    setIsGenerating(false);
  };

  const currentExample = exampleInputs[selectedExample];

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

      {/* Hero + Demo */}
      <section className="container mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-fn-text-primary mb-4">
            See it in action
          </h1>
          <p className="text-xl text-fn-text-secondary max-w-2xl mx-auto">
            Try our interactive demo. Select an example, click generate, and watch
            FlashNote transform shorthand into a complete SOAP note.
          </p>
        </div>

        {/* Interactive Demo */}
        <div className="max-w-5xl mx-auto">
          <div className="card shadow-fn-xl overflow-hidden">
            {/* Demo Header */}
            <div className="bg-fn-bg-secondary border-b border-fn-border-primary p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-fn-red-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-fn-amber-400 rounded-full"></div>
                  <div className="w-3 h-3 bg-fn-emerald-400 rounded-full"></div>
                  <span className="ml-3 text-sm font-medium text-fn-text-secondary">FlashNote Demo</span>
                </div>
                <div className="flex items-center gap-2">
                  {exampleInputs.map((example, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleChange(index)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedExample === index
                          ? 'bg-fn-emerald-100 text-fn-emerald-700'
                          : 'bg-fn-bg-primary text-fn-text-muted hover:bg-fn-stone-100'
                      }`}
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Demo Content */}
            <div className="p-6 md:p-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Input Side */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-fn-text-primary">Your Shorthand</h3>
                    <span className="text-xs text-fn-text-muted bg-fn-bg-secondary px-2 py-1 rounded">
                      {currentExample.shorthand.length} characters
                    </span>
                  </div>
                  <div className="bg-fn-bg-secondary border border-fn-border-primary rounded-fn-lg p-4 mb-4 min-h-[160px]">
                    <p className="font-mono text-sm text-fn-text-primary leading-relaxed">
                      {currentExample.shorthand}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Generate SOAP Note
                      </>
                    )}
                  </button>
                </div>

                {/* Output Side */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-fn-text-primary">Generated Note</h3>
                    {showOutput && (
                      <span className="text-xs text-fn-emerald-600 bg-fn-emerald-50 px-2 py-1 rounded flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Ready to copy
                      </span>
                    )}
                  </div>
                  <div className={`border rounded-fn-lg p-4 min-h-[260px] transition-all ${
                    showOutput
                      ? 'bg-fn-emerald-50 border-fn-emerald-200'
                      : 'bg-fn-bg-secondary border-fn-border-primary'
                  }`}>
                    {showOutput ? (
                      <div className="text-sm text-fn-text-primary space-y-3">
                        <p><strong className="text-fn-emerald-700">SUBJECTIVE:</strong> {currentExample.output.s}</p>
                        <p><strong className="text-fn-emerald-700">OBJECTIVE:</strong> {currentExample.output.o}</p>
                        <p><strong className="text-fn-emerald-700">ASSESSMENT:</strong> {currentExample.output.a}</p>
                        <p><strong className="text-fn-emerald-700">PLAN:</strong> {currentExample.output.p}</p>
                      </div>
                    ) : isGenerating ? (
                      <div className="flex items-center justify-center h-full text-fn-text-muted">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-fn-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                          <p>Processing your shorthand...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-fn-text-muted">
                        <div className="text-center">
                          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p>Click &ldquo;Generate&rdquo; to see the result</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Demo Footer */}
            <div className="bg-fn-gradient-primary p-4 text-center">
              <p className="text-white text-sm">
                This is a demo. <Link href="/signup" className="underline font-semibold hover:no-underline">Sign up free</Link> to generate unlimited notes with your own shorthand.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Value Props - Brief */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="text-4xl font-bold text-gradient mb-2">&lt;30s</div>
            <p className="text-fn-text-secondary">Per note</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gradient mb-2">100%</div>
            <p className="text-fn-text-secondary">HIPAA compliant</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gradient mb-2">Any</div>
            <p className="text-fn-text-secondary">EMR compatible</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gradient mb-2">$29</div>
            <p className="text-fn-text-secondary">Per month</p>
          </div>
        </div>
      </section>

      {/* Why PTs Love It */}
      <section className="bg-fn-bg-secondary py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-fn-text-primary mb-12">
            Why PTs Love FlashNote
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="card p-6 text-center">
              <div className="w-14 h-14 bg-fn-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-fn-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-fn-text-primary mb-2">Save 5+ Hours Weekly</h3>
              <p className="text-fn-text-secondary text-sm">
                Stop spending evenings on documentation. Finish notes before you leave the clinic.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-14 h-14 bg-fn-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-fn-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-fn-text-primary mb-2">Insurance-Ready Notes</h3>
              <p className="text-fn-text-secondary text-sm">
                Properly documented for medical necessity. Reduce claim denials.
              </p>
            </div>
            <div className="card p-6 text-center">
              <div className="w-14 h-14 bg-fn-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-fn-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-fn-text-primary mb-2">Reduce Burnout</h3>
              <p className="text-fn-text-secondary text-sm">
                Documentation is the #1 cause of PT burnout. FlashNote gives you your life back.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-3xl mx-auto">
          <div className="card p-8 md:p-12 text-center">
            <div className="flex justify-center mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-6 h-6 text-fn-amber-400 fill-current" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <blockquote className="text-xl md:text-2xl text-fn-text-primary mb-6 leading-relaxed">
              &ldquo;I was skeptical of AI tools, but FlashNote is different. It actually understands
              PT terminology. The notes are accurate, thorough, and save me hours every day.&rdquo;
            </blockquote>
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 bg-fn-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                MJ
              </div>
              <div className="text-left">
                <div className="font-semibold text-fn-text-primary">Michael J., DPT</div>
                <div className="text-sm text-fn-text-muted">Sports Rehabilitation • 9 years experience</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-fn-gradient-primary py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to try it yourself?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-xl mx-auto">
            Start your free 14-day trial. No credit card required.
          </p>
          <Link href="/signup" className="inline-block bg-white text-fn-emerald-600 font-semibold px-8 py-4 rounded-fn-lg text-lg hover:bg-fn-cream-50 transition-colors">
            Start Free Trial
          </Link>
          <p className="text-sm text-white/60 mt-4">
            Unlimited notes • Works with any EMR • HIPAA compliant
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
