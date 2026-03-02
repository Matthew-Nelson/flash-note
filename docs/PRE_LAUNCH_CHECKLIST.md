# FlashNote Pre-Launch Business Checklist

**Purpose:** Complete checklist of business, legal, compliance, and operational requirements before onboarding real users, charging money, and handling real patient information.

**Status Key:**
- [ ] Not started
- [~] In progress / Partially complete
- [x] Complete

---

## 1. Business Formation & Legal Structure

### Entity Formation
- [ ] **Choose business entity type** (LLC recommended for liability protection)
  - Recommendation: Single-member LLC initially, can elect S-Corp later for tax benefits at $40k+ profit
- [ ] **Choose state of incorporation**
  - Wyoming: $100 filing, $60/year, no state income tax, strong privacy
  - Delaware: $90 filing, $300/year, business-friendly laws
  - Your home state: May be required if operating there anyway
- [ ] **File Articles of Organization/Incorporation**
- [ ] **Obtain EIN (Employer Identification Number)** from IRS (free, same-day online)
- [ ] **Register for state business license** (if required in your state)
- [ ] **Appoint a Registered Agent** ($50-300/year)
  - Required in state of incorporation
  - Can use a service for privacy (Northwest, Incfile, etc.)
- [ ] **Create Operating Agreement** (LLC) or Bylaws (Corp)
- [ ] **Open business bank account** (requires EIN)
- [ ] **Set up business accounting** (QuickBooks Self-Employed, Wave, or similar)

### Business Insurance (Recommended for Healthcare)
- [ ] **Professional Liability / E&O Insurance** ($500-2,000/year)
  - Covers claims of negligence or errors in your service
  - Important for healthcare-adjacent software
- [ ] **Cyber Liability Insurance** ($500-1,500/year)
  - Covers data breach costs, notification, legal fees
  - Often required by enterprise healthcare customers
- [ ] **General Business Liability** ($400-800/year)
  - Basic protection for business operations

**Estimated Cost:** $200-500 initial + $100-300/year (bootstrapped) or $1,500-4,000/year (with insurance)

---

## 2. HIPAA/HITECH Compliance & Legal Documents

> **Regulatory Context:** The HITECH Act of 2009 made business associates (like FlashNote) **directly liable** for HIPAA violations, subject to direct OCR audits, and introduced tiered penalties up to $2.1M/year per violation category. All compliance items below address both HIPAA and HITECH requirements.

### Business Associate Agreements (BAAs)

**BAAs You Need to SIGN (as the customer):**
- [x] **Google Cloud BAA** (for Vertex AI / Gemini)
  - Signed Feb 2026 via GCP Console → IAM & Admin → Privacy
  - Covers all HIPAA-eligible GCP services: Cloud Run, Cloud SQL, Vertex AI
  - Must use Vertex AI endpoint (not consumer Gemini API)
- [x] **Hosting Provider BAA** (Google Cloud)
  - Covered by the single Google Cloud BAA signed above
- [x] **Database Provider BAA**
  - Cloud SQL is covered under the Google Cloud BAA (same agreement covers all HIPAA-eligible GCP services)

**BAA You Need to PROVIDE (to customers):**
- [~] **Customer BAA Template** - Template at `docs/legal/BAA_TEMPLATE.md`
  - [x] Pass-through processing model language added (no PHI storage)
  - [x] Subcontractor compliance exhibit added (provider-agnostic)
  - [ ] Have healthcare attorney review template
  - [ ] Finalize and host on website
  - [ ] Create signing workflow (DocuSign, HelloSign, or manual)

### Legal Documents for Website

**All templates exist but need finalization:**

- [~] **Terms of Service** - Draft at `docs/legal/TERMS_OF_SERVICE.md`
  - [ ] Fill in company name, address, state of incorporation
  - [ ] Have attorney review (especially healthcare disclaimers)
  - [ ] Add effective date
  - [ ] Host at flashnote.co/terms

- [~] **Privacy Policy** - Draft at `docs/legal/PRIVACY_POLICY.md`
  - [ ] Fill in company details and third-party service names
  - [ ] Ensure HIPAA language is accurate
  - [ ] Have attorney review
  - [ ] Host at flashnote.co/privacy

- [ ] **HIPAA/HITECH Notice** (optional but recommended)
  - Brief statement about HIPAA and HITECH Act compliance for marketing
  - Can be part of Privacy Policy or separate page

- [x] **Refund Policy** - Added inline to Terms of Service
  - Monthly: No partial refunds
  - Annual: Pro-rata within 30 days
  - See `docs/legal/TERMS_OF_SERVICE.md` §4

### HITECH Breach Notification & Incident Response

- [x] **Document breach notification procedure** (required by HITECH Act) — see [INCIDENT_RESPONSE_PLAN.md](./compliance/INCIDENT_RESPONSE_PLAN.md)
  - 72-hour notification to covered entities upon breach discovery
  - Breach investigation and documentation process
  - Cooperation with covered entity's notification to individuals and HHS
  - Template breach notification letter
- [x] **Document incident response plan** — see [INCIDENT_RESPONSE_PLAN.md](./compliance/INCIDENT_RESPONSE_PLAN.md)
  - Who is responsible for breach assessment
  - Escalation path and decision tree
  - Evidence preservation procedures
  - Communication templates for covered entities
- [x] **Verify Google Cloud/Vertex AI BAA is signed**
  - Signed Feb 2026. Must use Vertex AI endpoint (consumer Gemini API is NOT covered)

**Estimated Legal Cost:** $0 (templates only) to $1,500-3,000 (attorney review)

---

## 3. Financial & Payment Setup

### Stripe Configuration
- [ ] **Create Stripe account** (if not done)
- [ ] **Complete Stripe identity verification**
  - SSN/EIN verification
  - Bank account linking
  - Business verification documents
- [ ] **Create Products and Prices**
  - Monthly: $29/month (price_monthly_xxx)
  - Annual: $290/year (price_annual_xxx)
- [ ] **Configure Customer Portal**
  - Enable subscription management
  - Enable payment method updates
  - Enable invoice history

#### Webhook Setup

**For Local Development (using Stripe CLI):**
1. Install the Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows (scoop)
   scoop install stripe

   # Or download from https://stripe.com/docs/stripe-cli
   ```
2. Login to your Stripe account:
   ```bash
   stripe login
   ```
3. Start the webhook listener (run this while developing):
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
4. Copy the webhook signing secret (`whsec_xxx`) it outputs and add to your `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
5. Keep the listener running while testing - it tunnels Stripe events to localhost

**For Production:**
- [ ] **Set up Webhook endpoint in Stripe Dashboard**
  - Go to Developers → Webhooks → Add endpoint
  - Endpoint URL: `https://flashnote.co/api/webhooks/stripe` (single-origin — no `api.` subdomain)
  - Subscribe to required events:
    - `checkout.session.completed`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_failed`
    - `invoice.paid`
  - Copy the signing secret to production environment variables

- [ ] **Test Stripe integration in test mode**
  - Complete checkout flow
  - Test subscription updates
  - Test cancellation
  - Test failed payments (use card `4000000000000341`)
  - Test successful renewal
- [ ] **Configure webhook event cleanup job scheduling**
  - DAL function exists (`cleanupOldWebhookEvents` in `web/src/server/dal/webhooks.ts`)
  - Route Handler exists (`/api/cleanup/webhook-events`)
  - Needs: Cloud Scheduler trigger to call the route on a daily cron
  - See `docs/STRIPE_TODOS.md` Operations section for options
- [ ] **Switch to Stripe live mode** when ready

### Tax & Accounting
- [ ] **Determine sales tax obligations**
  - SaaS is taxable in some states (TX, NY, PA, etc.)
  - Consider using Stripe Tax or TaxJar for automation
- [ ] **Set up quarterly estimated tax payments**
  - Federal: 15.3% self-employment + income tax bracket
  - State: Varies
- [ ] **Establish bookkeeping system**
  - Track all income and expenses
  - Categorize for tax deductions
- [ ] **Consult with CPA** (recommended)
  - Healthcare software may have specific deductions
  - S-Corp election timing advice

---

## 4. Domain & Infrastructure

### Domain Setup
- [ ] **Purchase primary domain** (flashnote.co or similar)
  - Namecheap, Google Domains, Cloudflare Registrar
  - Consider purchasing variations for protection
- [ ] **Configure DNS records**
  - A record for flashnote.co → Cloud Run service
  - CNAME for www → Cloud Run
  - MX records for email (if using custom email)
- [ ] **Enable DNSSEC** (recommended)
- [ ] **Set up email**
  - support@flashnote.co
  - legal@flashnote.co (for BAA/legal inquiries)
  - Consider Google Workspace, Zoho, or Fastmail

### Production Infrastructure
- [ ] **Deploy Next.js App (Cloud Run)**
  - [ ] Create GCP project and enable Cloud Run API
  - [ ] Configure environment variables (Cloud Run secrets or Secret Manager)
  - [ ] Set up SSL/TLS (automatic with Cloud Run custom domains)
  - [ ] Configure custom domain (flashnote.co)
  - [ ] Configure min/max instances for scaling (deploy.yml defaults to `min-instances=0` for pre-launch cost savings; **increase to 1 before production traffic** to avoid cold starts)

- [ ] **Deploy Production Database (Cloud SQL)**
  - [ ] Create Cloud SQL PostgreSQL instance with encryption at rest
  - [ ] Enable automatic backups
  - [ ] Test backup restoration
  - [ ] Configure Cloud SQL Auth Proxy or private IP for Cloud Run connection
  - [ ] Document connection string securely (use Secret Manager)

- [~] **Configure monitoring and alerting**
  - [ ] Error tracking (GCP Cloud Error Reporting via Pino structured logger — see [planning/MONITORING_SETUP.md](./planning/MONITORING_SETUP.md))
  - [ ] Uptime monitoring (UptimeRobot, Better Uptime - free tiers)
  - [ ] Set up alerting for downtime/errors

### Production Security
- [ ] **Verify TLS configuration**
  - TLS 1.2+ only
  - Test with SSL Labs (ssllabs.com)
- [ ] **Enable database encryption**
  - At-rest encryption
  - In-transit encryption (SSL connections)
- [x] **Review environment variables** - See `web/src/server/db/config.ts` for full schema
  - `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` - Used for price ID validation in billing routes

**Estimated Monthly Cost:** ~$15-45/month (basic Cloud Run + Cloud SQL) to $100-300/month (production scale)

---

## 5. Security Remediation (Pre-Launch Critical)

> The authoritative security audit is [compliance/CONSOLIDATED_AUDIT_2026_02.md](./compliance/CONSOLIDATED_AUDIT_2026_02.md) (Feb 2026, 69 findings). The original `SECURITY_AUDIT.md` (Jan 2026) has been archived — its findings were resolved, but the consolidated audit found additional issues.

**Current status:** All 5 CRITICALs resolved. 16 of 18 HIGH findings resolved (remaining 2 are moot or resolved by architecture). Majority of MEDIUM/LOW findings resolved by migration (extension removed, Express replaced, sessions replaced JWT). See [ROADMAP.md Phase 0](./ROADMAP.md#phase-0-pre-migration-foundations) for full audit disposition.

---

## 6. ~~Chrome Web Store Preparation~~ — Removed

> **Architecture change (March 2026):** FlashNote is a web-only application. The Chrome extension has been sunset. All items in this section are no longer applicable.

---

## 7. Testing & Quality Assurance

### Functional Testing (Production Environment)
- [ ] **Auth flows**
  - [ ] Register new account
  - [ ] Email verification (click link from email)
  - [ ] Resend verification email
  - [ ] Login with valid credentials
  - [ ] Login with invalid credentials (rate limiting)
  - [ ] Login with unverified email (should work but flag `emailVerified: false`)
  - [ ] Logout
  - [ ] Request password reset
  - [ ] Complete password reset (click link from email)
  - [ ] Login with new password after reset
- [ ] **Note generation**
  - [ ] All 4 note types (daily, initial eval, progress, discharge)
  - [ ] Copy individual sections
  - [ ] Copy full note
  - [ ] Error handling for AI failures
- [ ] **Subscription flows**
  - [ ] Complete checkout (use Stripe test cards first)
  - [ ] Verify webhook updates user status
  - [ ] Test trial expiration enforcement
  - [ ] Test subscription cancellation
  - [ ] Test failed payment handling
- [ ] **Edge cases**
  - [ ] Very long input notes
  - [ ] Empty/minimal input
  - [ ] Network disconnection handling
  - [ ] Concurrent requests

### Security Testing
- [ ] **Run automated security scan** (OWASP ZAP, Burp Suite free)
- [ ] **Test rate limiting** is enforced
- [ ] **Verify no PHI in logs** (check all log outputs)

### Cross-Browser Testing
- [ ] **Chrome** (primary target)
- [ ] **Firefox**
- [ ] **Safari**
- [ ] **Microsoft Edge** (Chromium-based)

---

## 8. Beta Testing Program

### Recruit Beta Testers (5-10 PTs)
- [ ] **Identify recruitment channels**
  - Personal network
  - r/physicaltherapy subreddit
  - PT Facebook groups
  - Local PT clinics
- [ ] **Create beta signup form**
  - Collect: Name, email, EMR used, practice type
- [ ] **Prepare beta tester agreement**
  - Confidentiality expectations
  - Feedback requirements
  - Understanding it's pre-release software

### Beta Feedback Collection
- [ ] **Create feedback mechanism**
  - Simple form or email
  - Track: Note quality, UI issues, feature requests
- [ ] **Schedule check-in calls** with beta testers
- [ ] **Document and prioritize feedback**
- [ ] **Fix critical issues** before public launch

---

## 9. Customer Support Readiness

### Support Infrastructure
- [ ] **Set up support email** (support@flashnote.co)
- [ ] **Create help documentation / FAQ**
  - How to use FlashNote
  - How to generate notes
  - How to manage subscription
  - Troubleshooting common issues
- [ ] **Prepare response templates**
  - Account issues
  - Billing questions
  - Feature requests
  - Bug reports

### Incident Response
- [ ] **Document incident response procedure**
  - Who to contact for outages
  - How to communicate with users
  - Escalation path
- [ ] **Create status page** (optional but recommended)
  - Statuspage.io, Instatus (free tiers available)

---

## 10. Launch Readiness

### Pre-Launch Final Checks
- [ ] **All critical security issues resolved**
- [ ] **Production environment stable for 48+ hours**
- [ ] **Stripe live mode tested with real $1 charge (refund immediately)**
- [ ] **Legal documents published on website**
- [ ] **BAA ready to provide to customers**
- [ ] **Support email working**

### Launch Day Checklist
- [ ] **Announce launch**
  - Social media (LinkedIn, Twitter/X)
  - PT communities (with permission)
  - Consider Product Hunt launch
- [ ] **Monitor closely**
  - Error rates
  - Sign-up conversions
  - Support volume
- [ ] **Be available for rapid response**

---

## 11. Ongoing Compliance & Operations

### Monthly Tasks
- [ ] Review audit logs for anomalies
- [ ] Check for dependency security updates
- [ ] Review error logs for patterns
- [ ] Monitor usage metrics

### Quarterly Tasks
- [ ] Review and update security controls
- [ ] Test backup restoration
- [ ] Review access logs
- [ ] Update documentation as needed

### Annual Tasks
- [ ] HIPAA/HITECH security risk assessment
- [ ] Legal document review and update (BAA, ToS, Privacy Policy)
- [ ] Insurance policy review
- [ ] Review HITECH Safe Harbor alignment (consider NIST CSF, SOC 2)
- [ ] Verify all subprocessor BAAs remain current (Google Cloud, hosting, etc.)
- [ ] Consider penetration testing ($3,000-15,000)

---

## Cost Summary

### One-Time Costs
| Item | Low Estimate | High Estimate |
|------|--------------|---------------|
| LLC Formation | $100 | $300 |
| Domain (1 year) | $12 | $20 |
| Legal Document Review | $0 | $3,000 |
| **Total One-Time** | **$112** | **$3,320** |

### Monthly Recurring Costs
| Item | Low Estimate | High Estimate |
|------|--------------|---------------|
| Hosting (Cloud Run + Cloud SQL) | $15 | $100 |
| Email/Productivity | $0 | $12 |
| Monitoring | $0 | $20 |
| **Total Monthly** | **$15** | **$132** |

### Annual Recurring Costs
| Item | Low Estimate | High Estimate |
|------|--------------|---------------|
| Registered Agent | $50 | $150 |
| LLC Annual Report | $25 | $300 |
| Domain Renewal | $12 | $20 |
| Insurance | $0 | $4,000 |
| CPA/Tax Filing | $0 | $500 |
| **Total Annual** | **$87** | **$4,970** |

### Per-Transaction Costs (at $29/mo price)
| Item | Cost |
|------|------|
| Stripe Fee | $1.14 (2.9% + $0.30) |
| LLM Cost (20 notes) | ~$0.01 |
| **Total per Customer** | **~$1.15/month** |

---

## Launch Sequence (Recommended Order)

### Phase 1: Legal Foundation (Week 1)
1. Form LLC and obtain EIN
2. Open business bank account
3. Set up basic bookkeeping

### Phase 2: Compliance (Week 2)
1. Sign Google Cloud BAA
2. Secure HIPAA-compliant hosting
3. Have legal documents reviewed (can run parallel)

### Phase 3: Infrastructure (Week 3)
1. Deploy production environment
2. Configure monitoring
3. Run security tests

### Phase 4: Payments (Week 4)
1. Configure Stripe live mode
2. Finalize and publish legal documents

### Phase 5: Beta (Weeks 5-6)
1. Recruit beta testers
2. Collect feedback
3. Fix issues

### Phase 6: Launch (Week 7)
1. Final testing
2. Announce launch
3. Monitor and support

---

## Resources & Links

### Business Formation
- [Wyoming LLC Filing](https://wyobiz.wyo.gov/)
- [IRS EIN Application](https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online)
- [Registered Agent Services](https://www.northwestregisteredagent.com/)

### HIPAA/HITECH Compliance
- [Google Cloud BAA](https://cloud.google.com/security/compliance/hipaa)
- [HHS HIPAA Resources](https://www.hhs.gov/hipaa/)
- [HITECH Act Text](https://www.congress.gov/bill/111th-congress/house-bill/1/text)
- [HITECH Breach Notification Rule](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-D)
- [HITECH Safe Harbor (2021)](https://www.congress.gov/bill/116th-congress/house-bill/7898)

### Payment Processing
- [Stripe Atlas](https://stripe.com/atlas) (business formation bundle)
- [Stripe Documentation](https://stripe.com/docs)

---

*Last Updated: March 2026*
*This checklist should be reviewed with legal and financial professionals for your specific situation.*
