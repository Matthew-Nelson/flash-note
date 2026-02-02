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

## 2. HIPAA Compliance & Legal Documents

### Business Associate Agreements (BAAs)

**BAAs You Need to SIGN (as the customer):**
- [ ] **Google Cloud BAA** (for Vertex AI / Gemini)
  - Free, required for HIPAA-compliant LLM usage
  - Sign at: Google Cloud Console → Compliance → BAA
  - Must use Vertex AI endpoint (not consumer Gemini API)
- [ ] **Hosting Provider BAA** (Render, Railway, or alternative)
  - Verify HIPAA compliance and BAA availability
  - Render: Contact enterprise sales for BAA
  - Railway: May not offer BAA - consider HIPAA-compliant alternatives:
    - AWS (free BAA with Business Support)
    - Google Cloud Run
    - Azure
- [ ] **Database Provider BAA**
  - If using managed PostgreSQL, ensure BAA coverage
  - Cloud SQL (GCP), RDS (AWS), or Azure Database all offer BAAs

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
  - [ ] Host at flashnote.com/terms

- [~] **Privacy Policy** - Draft at `docs/legal/PRIVACY_POLICY.md`
  - [ ] Fill in company details and third-party service names
  - [ ] Ensure HIPAA language is accurate
  - [ ] Have attorney review
  - [ ] Host at flashnote.com/privacy

- [ ] **HIPAA Notice** (optional but recommended)
  - Brief statement about HIPAA compliance for marketing
  - Can be part of Privacy Policy or separate page

- [x] **Refund Policy** - Added inline to Terms of Service
  - Monthly: No partial refunds
  - Annual: Pro-rata within 30 days
  - See `docs/legal/TERMS_OF_SERVICE.md` §4

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
   stripe listen --forward-to localhost:4000/billing/webhook
   ```
4. Copy the webhook signing secret (`whsec_xxx`) it outputs and add to your `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   ```
5. Keep the listener running while testing - it tunnels Stripe events to localhost

**For Production:**
- [ ] **Set up Webhook endpoint in Stripe Dashboard**
  - Go to Developers → Webhooks → Add endpoint
  - Endpoint URL: `https://api.flashnote.app/billing/webhook`
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
- [ ] **Configure webhook event cleanup job**
  - The `processed_webhook_events` table needs periodic cleanup
  - Set up daily cron job to delete events older than 7 days
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
- [ ] **Purchase primary domain** (flashnote.com or similar)
  - Namecheap, Google Domains, Cloudflare Registrar
  - Consider purchasing variations for protection
- [ ] **Configure DNS records**
  - A record for api.flashnote.com → Backend host
  - CNAME for www → Web host (Vercel)
  - MX records for email (if using custom email)
- [ ] **Enable DNSSEC** (recommended)
- [ ] **Set up email**
  - support@flashnote.com
  - legal@flashnote.com (for BAA/legal inquiries)
  - Consider Google Workspace, Zoho, or Fastmail

### Production Infrastructure
- [ ] **Deploy Backend API**
  - [ ] Choose HIPAA-compliant hosting (see BAA requirements above)
  - [ ] Configure environment variables
  - [ ] Set up SSL/TLS (automatic with most providers)
  - [ ] Configure custom domain (api.flashnote.com)
  - [ ] Set up auto-scaling if needed

- [ ] **Deploy Production Database**
  - [ ] PostgreSQL with encryption at rest
  - [ ] Enable automatic backups
  - [ ] Test backup restoration
  - [ ] Set up connection pooling
  - [ ] Document connection string securely

- [ ] **Deploy Web/Landing Page**
  - [ ] Deploy to Vercel (or similar)
  - [ ] Configure custom domain
  - [ ] Set environment variables

- [ ] **Configure monitoring and alerting**
  - [ ] Error tracking (Sentry - free tier)
  - [ ] Uptime monitoring (UptimeRobot, Better Uptime - free tiers)
  - [ ] Set up alerting for downtime/errors

### Production Security
- [ ] **Generate production secrets**
  - JWT_SECRET (256-bit random)
  - JWT_REFRESH_SECRET (256-bit random)
  - CSRF_SECRET (256-bit random)
  - Use: `openssl rand -base64 32`
- [ ] **Verify TLS configuration**
  - TLS 1.2+ only
  - Test with SSL Labs (ssllabs.com)
- [ ] **Enable database encryption**
  - At-rest encryption
  - In-transit encryption (SSL connections)
- [x] **Review environment variables** - See `backend/src/config.ts` for full schema
  - `API_URL` - Currently unused, kept for future inter-service communication
  - `GCP_PROJECT_ID` - Currently unused, kept for future Vertex AI migration
  - `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` - Used for price ID validation in billing routes

**Estimated Monthly Cost:** ~$15-50/month (basic) to $100-300/month (HIPAA-compliant cloud)

---

## 5. Security Remediation (Pre-Launch Critical)

Based on `SECURITY_AUDIT.md`, these should be addressed before handling real patient data:

### Resolved ✅
- [x] **HIGH-013: Query statement timeout** - DoS prevention
- [x] **HIGH-003: Content Security Policy** - XSS protection
- [x] **HIGH-005: Account lockout mechanism** - Brute force protection
- [x] **HIGH-012: Email in failed login audit** - Accepted risk (standard practice)
- [x] **MEDIUM-012: Sanitize LLM error logging** - PHI leakage prevention
- [x] **HIGH-001 + HIGH-007: Password reset + email verification**
- [x] **HIGH-006 + MEDIUM-002 + MEDIUM-011: Session infrastructure** - Device binding, O(1) token validation, session limits
- [x] **MEDIUM-007 + MEDIUM-015: CORS configuration** - Explicit ALLOWED_ORIGINS env var

### Resolved ✅ (continued)
- [x] **MEDIUM-005: Prompt injection mitigation** - XML delimiters + detection
- [x] **MEDIUM-010: Prompt warnings may leak context** - Verified PHI-safe
- [x] **MEDIUM-013: Webhook idempotency** - Database-backed deduplication
- [x] **MEDIUM-014: Extension retry logic** - Exponential backoff implemented

### Accepted Risk (Low Priority)
- [x] MEDIUM-003: Session timeout warning - Silent refresh already implemented
- [x] MEDIUM-008: Extension token storage separation - Device binding mitigates

### Deferred (Observability Track)
- [ ] LOW-001: Structured logging - See `docs/planning/MONITORING_SETUP.md`

---

## 6. Chrome Web Store Preparation

### Developer Account
- [ ] **Create Chrome Web Store Developer Account** ($5 one-time fee)
- [ ] **Complete identity verification** (may take a few days)

### Extension Preparation
- [ ] **Update manifest.json with production values**
  - Correct API URLs
  - Final extension name and description
  - Production extension ID
- [ ] **Create store listing assets**
  - [ ] Icon: 128x128 PNG (placeholder exists, needs professional redesign)
  - [ ] Screenshots: 1280x800 or 640x400 (at least 1, up to 5)

> **Note:** Current extension icons are placeholders. Generate production-quality icons before Chrome Web Store submission.
  - [ ] Promotional images (optional but recommended):
    - Small: 440x280
    - Large: 920x680
    - Marquee: 1400x560
- [ ] **Write store listing copy**
  - Short description (132 characters max)
  - Detailed description (see FLASHNOTE_HANDOFF.md for template)
  - Category: Productivity
- [ ] **Prepare Privacy Policy URL** (required)
- [ ] **Build production extension package**
  - `pnpm build && pnpm package`
  - Creates .zip for upload
- [ ] **Submit for review**
  - Review typically takes 1-5 business days
  - May require additional justification for permissions

### Post-Approval
- [ ] **Note your extension ID** for CORS configuration
- [ ] **Set up extension update process**

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
  - [ ] Token refresh
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
- [ ] **Test CORS configuration** with extension

### Cross-Browser Testing
- [ ] **Chrome** (primary target)
- [ ] **Microsoft Edge** (Chromium-based)
- [ ] **Brave** (Chromium-based)

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
- [ ] **Set up support email** (support@flashnote.com)
- [ ] **Create help documentation / FAQ**
  - How to install the extension
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
- [ ] **Extension approved in Chrome Web Store**
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
- [ ] HIPAA security risk assessment
- [ ] Legal document review and update
- [ ] Insurance policy review
- [ ] Consider penetration testing ($3,000-15,000)

---

## Cost Summary

### One-Time Costs
| Item | Low Estimate | High Estimate |
|------|--------------|---------------|
| LLC Formation | $100 | $300 |
| Chrome Store Developer | $5 | $5 |
| Domain (1 year) | $12 | $20 |
| Legal Document Review | $0 | $3,000 |
| **Total One-Time** | **$117** | **$3,325** |

### Monthly Recurring Costs
| Item | Low Estimate | High Estimate |
|------|--------------|---------------|
| Hosting (API + DB) | $15 | $100 |
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

### Phase 4: Payments & Store (Week 4)
1. Configure Stripe live mode
2. Submit extension to Chrome Web Store
3. Finalize and publish legal documents

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

### HIPAA Compliance
- [Google Cloud BAA](https://cloud.google.com/security/compliance/hipaa)
- [HHS HIPAA Resources](https://www.hhs.gov/hipaa/)

### Chrome Web Store
- [Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
- [Publishing Documentation](https://developer.chrome.com/docs/webstore/publish/)

### Payment Processing
- [Stripe Atlas](https://stripe.com/atlas) (business formation bundle)
- [Stripe Documentation](https://stripe.com/docs)

---

*Last Updated: February 2026*
*This checklist should be reviewed with legal and financial professionals for your specific situation.*
