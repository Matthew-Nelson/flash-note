# LLC Formation and Business Setup Guide

**Purpose:** Step-by-step guide to legally establish and operate FlashNote as a business
**Audience:** Matthew (founder)
**Status:** Pre-launch requirements
**Last Updated:** 2026-02-02

---

## Table of Contents

1. [Overview](#overview)
2. [Order of Operations](#order-of-operations)
3. [LLC Formation](#llc-formation)
4. [Business Banking](#business-banking)
5. [Accounting Setup](#accounting-setup)
6. [Paying for Services](#paying-for-services)
7. [Tax Obligations](#tax-obligations)
8. [GitHub and IP Protection](#github-and-ip-protection)
9. [Legal Protection Within LLC](#legal-protection-within-llc)
10. [Ongoing Compliance](#ongoing-compliance)

---

## Overview

### What is an LLC?

A **Limited Liability Company (LLC)** is a legal business structure that:
- **Protects personal assets** from business liabilities
- **Provides tax flexibility** (default pass-through, can elect S-Corp)
- **Establishes separate legal entity** for contracts and operations
- **Requires minimal formalities** compared to corporations

### Why FlashNote Needs an LLC

1. **Liability Protection:** If someone sues FlashNote for HIPAA/HITECH violations (fines up to $2.1M/year per violation category), your personal assets (house, car, savings) are protected
2. **Professionalism:** Customers trust "FlashNote LLC" more than "Matthew Nelson DBA FlashNote"
3. **Tax Benefits:** Deduct business expenses, structure for tax optimization
4. **Banking:** Separate business bank account keeps finances clean
5. **Contracts:** Legal entity to sign contracts with Stripe, Google, customers

---

## Order of Operations

### The Correct Sequence

Here's the exact order you should do things (DO NOT skip or reorder):

```
1. Choose LLC State ────────────────────> California (you live there)
   └─> Cost: $70                           Timeline: Day 1

2. Choose LLC Name ─────────────────────> "FlashNote LLC" or similar
   └─> Check availability                  Timeline: Day 1
   └─> Reserve if needed ($10)

3. Prepare Formation Documents ─────────> Articles of Organization
   └─> Your info, registered agent         Timeline: Day 1-2

4. File LLC Formation ──────────────────> California Secretary of State
   └─> Online filing ($70)                 Timeline: Day 2-7
   └─> Wait for approval

5. Get EIN from IRS ────────────────────> Employer Identification Number
   └─> Free, online, instant               Timeline: Same day as LLC approval
   └─> REQUIRED for bank account

6. Draft Operating Agreement ───────────> LLC internal rules
   └─> Template is fine                    Timeline: Day 1-2
   └─> Not filed, keep in records

7. Open Business Bank Account ─────────> AFTER you have LLC + EIN
   └─> Requires: LLC docs, EIN, ID         Timeline: Day 3-10
   └─> Initial deposit: $100-500

8. Set Up Accounting ───────────────────> Wave (free) or QuickBooks
   └─> Connect bank account                Timeline: Same day as bank
   └─> Start tracking from day 1

9. Get Business Credit Card (Optional)─> Separate business expenses
   └─> Builds business credit              Timeline: After bank account
   └─> Not required initially

10. Transfer Code/IP to LLC ───────────> Assign ownership
    └─> See GitHub section below           Timeline: After LLC formed
    └─> Document in writing

11. Update Service Providers ──────────> Google Cloud, Vercel, Stripe, etc.
    └─> Change to LLC name                 Timeline: After bank account
    └─> Use business payment method

12. File Statement of Information ────> California requirement
    └─> Within 90 days of formation        Timeline: Within 90 days
    └─> Cost: $0 (included in $70 fee)

13. Set Up Tax Accounts ────────────────> IRS, CA FTB, CA EDD
    └─> Quarterly estimated taxes          Timeline: Before first revenue
    └─> See tax section below
```

**Total Timeline:** 1-2 weeks to fully operational

---

## LLC Formation

### Step 1: Choose Your State

**Recommendation:** **Form in California**

**Why California:**
- ✅ You live and operate in CA
- ✅ Avoids dual registration fees
- ✅ Simpler compliance
- ❌ Higher annual tax ($800 minimum franchise tax)

**Why NOT Delaware/Wyoming:**
- You'd still owe CA $800/year franchise tax
- Plus Delaware/Wyoming fees ($300-400/year)
- Total: $1,100+/year instead of $800/year
- Added complexity for no benefit

**Decision:** California LLC

### Step 2: Name Your LLC

**Requirements:**
- Must include "LLC" or "Limited Liability Company"
- Cannot conflict with existing CA businesses
- Cannot use restricted words without licenses

**Check availability:**
```
https://bizfileonline.sos.ca.gov/search/business

Search for:
- FlashNote LLC
- FlashNote, LLC
- Flash Note LLC
```

**Recommendations:**
1. **FlashNote LLC** (first choice)
2. **FlashNote Health LLC** (if taken)
3. **FlashNote AI LLC** (alternative)

**Reserve name (optional):** $10 for 60 days if you're not ready to file

### Step 3: Choose a Registered Agent

**What is a Registered Agent?**
- Person/company that receives legal documents on behalf of LLC
- Must have physical address in California
- Must be available during business hours

**Options:**

**Option A: You (Matthew) as Registered Agent**
- **Cost:** $0
- **Pro:** Free
- **Con:** Your home address becomes public record
- **Con:** You must be available to receive legal docs

**Option B: Professional Registered Agent Service**
- **Cost:** $50-300/year
- **Pro:** Privacy - keeps your address private
- **Pro:** Reliable - they're always available
- **Recommended services:**
  - Northwest Registered Agent: $125/year
  - ZenBusiness: $99/year (+ formation services)
  - Incfile: $119/year

**Recommendation:** Use professional service for privacy ($125/year)

### Step 4: File Articles of Organization

**Method 1: DIY Online Filing (RECOMMENDED)**

1. Go to: https://bizfileonline.sos.ca.gov/
2. Create account
3. Select "File an LLC"
4. Fill out form:
   - LLC Name: FlashNote LLC
   - Purpose: "To engage in any lawful act or activity"
   - Management: "Member-managed"
   - Registered Agent: [Your service or your name/address]
   - Principal Address: [Your address]
   - Organizer: [Your name]
5. Pay $70 filing fee (credit card)
6. Receive confirmation email
7. Wait 3-7 business days for approval
8. Download approved Articles of Organization

**Cost:** $70
**Time:** 15-30 minutes to file, 3-7 days to approve

**Method 2: Formation Service**

Services like LegalZoom, ZenBusiness, Incfile will:
- File on your behalf
- Provide operating agreement template
- Include registered agent for 1 year
- Provide compliance calendar

**Cost:** $200-500 (includes $70 state fee)
**Time:** They handle everything

**Recommendation:** DIY to save $200, it's simple

### Step 5: Get Your EIN (Federal Tax ID)

**What is an EIN?**
- Like a Social Security Number for your business
- Required to open bank account
- Required to hire employees (future)
- Required for tax filings
- **100% FREE from IRS**

**How to get it:**

1. **Wait until LLC is approved** (you'll have approval email)
2. Go to: https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online
3. Click "Apply Online Now"
4. Select "View Additional Types, Including Tax-Exempt..." if you don't see LLC
5. Select "Limited Liability Company"
6. Fill out SS-4 form online:
   - Legal name: FlashNote LLC
   - Trade name: FlashNote (optional)
   - Your name as Responsible Party
   - Your SSN
   - LLC address
   - Reason: "Started new business"
   - Number of employees: 0
7. Submit (takes 5 minutes)
8. **Receive EIN immediately**
9. Download and print EIN confirmation letter (CP 575)

**Cost:** $0 (FREE from IRS)
**Time:** 10 minutes, instant approval

**IMPORTANT:**
- Only use IRS.gov (official site)
- Beware of scam sites charging $50-300 for "EIN service"
- IRS NEVER charges for EIN

---

## Business Banking

### When to Open Account

**After you have:**
- ✅ LLC approved by California
- ✅ EIN from IRS
- ✅ Articles of Organization (PDF)
- ✅ Operating Agreement (template is fine)
- ✅ Your personal ID (driver's license)

**Timeline:** Within 1 week of LLC approval

### Choosing a Business Bank

**Options for small business:**

**1. Mercury (RECOMMENDED for startups)**
- ✅ Built for startups/tech companies
- ✅ 100% online application
- ✅ No monthly fees
- ✅ No minimum balance
- ✅ Good mobile app
- ✅ Integrates with accounting software
- ✅ Instant debit card
- ❌ No physical branches (not a problem for online business)

**Website:** mercury.com
**Cost:** $0/month
**Initial deposit:** $0

**2. Chase Business Complete Banking**
- ✅ Physical branches
- ✅ Large bank stability
- ✅ Good mobile app
- ❌ $15/month fee (waived if $2k balance)
- ❌ More paperwork

**Cost:** $0-15/month
**Initial deposit:** $0

**3. Bank of America Business Advantage**
- ✅ Physical branches
- ✅ Nationwide ATMs
- ❌ $16/month fee (waived if $5k balance)
- ❌ Complex fee structure

**Cost:** $0-16/month
**Initial deposit:** $25

**Recommendation:** Mercury for simplicity and $0 fees

### Opening the Account

**Documents needed:**
1. Articles of Organization (PDF from CA SOS)
2. EIN confirmation letter (PDF from IRS)
3. Operating Agreement (even if not filed)
4. Your driver's license
5. Your SSN

**Process (Mercury example):**
1. Go to mercury.com
2. Click "Open an Account"
3. Fill out application:
   - Business: FlashNote LLC
   - EIN: [your EIN]
   - Industry: Healthcare Technology / Software
   - Business description: "AI-powered documentation software for physical therapists"
   - Upload documents
4. Identity verification (photo of ID, selfie)
5. Wait 1-2 business days for approval
6. Access account, order debit card
7. Card arrives in 7-10 days

**Timeline:** 1-2 days approval, 7-10 days for card

### Initial Deposit

**How much to deposit:**
- **Minimum:** $100 (enough to cover first month expenses)
- **Recommended:** $500-1,000 (2-3 months runway)
- **Source:** Transfer from personal account

**How to fund:**
1. Link your personal bank account to business account
2. Transfer via ACH (takes 2-3 days)
3. Or deposit check at branch (if physical bank)

**Important:** Track this as "Owner Contribution" or "Equity Investment"

---

## Accounting Setup

### Why Accounting from Day 1

- ✅ Required for taxes
- ✅ Track deductible expenses
- ✅ Monitor profitability
- ✅ Required for business loans (future)
- ✅ Required if you get audited

### Choose Accounting Software

**Option 1: Wave (RECOMMENDED for start)**
- ✅ 100% free
- ✅ Simple double-entry accounting
- ✅ Connect bank account
- ✅ Automatic transaction imports
- ✅ Invoice generation
- ✅ Receipt scanning (mobile app)
- ✅ Reports for taxes
- ❌ Basic features only

**Website:** waveapps.com
**Cost:** $0/month

**Option 2: QuickBooks Self-Employed**
- ✅ Designed for self-employed/freelancers
- ✅ Mileage tracking
- ✅ Quarterly tax estimates
- ✅ Export to TurboTax
- ❌ $15/month

**Cost:** $15/month

**Option 3: QuickBooks Online Simple Start**
- ✅ Full small business features
- ✅ Inventory tracking (future)
- ✅ 1099 contractor management
- ❌ $30/month
- ❌ Overkill for now

**Cost:** $30/month

**Recommendation:** Start with Wave (free), upgrade later if needed

### Setting Up Wave

1. Go to waveapps.com
2. Sign up with business email (get flashnote.com email first)
3. Business info:
   - Name: FlashNote LLC
   - Industry: Software/SaaS
   - Address: [your LLC address]
   - EIN: [your EIN]
4. Connect business bank account:
   - Plaid integration links to Mercury/Chase/etc.
   - Automatically imports transactions
5. Set up chart of accounts (defaults are fine)
6. Start categorizing transactions

**Timeline:** 30 minutes to set up

### Chart of Accounts (Basics)

**Income:**
- 4000 - Revenue (subscription income)

**Expenses:**
- 5000 - Server/Hosting (Google Cloud, Vercel)
- 5100 - Software/Tools (Stripe fees, domain)
- 5200 - Marketing/Advertising
- 5300 - Legal/Professional Fees
- 5400 - Office Supplies
- 5500 - Bank Fees
- 5600 - Taxes (franchise tax, etc.)

**Assets:**
- 1000 - Business Bank Account
- 1100 - Accounts Receivable (future)

**Liabilities:**
- 2000 - Accounts Payable
- 2100 - Credit Card (if applicable)

**Equity:**
- 3000 - Owner's Equity (your initial investment)
- 3100 - Retained Earnings

---

## Paying for Services

### Using Personal vs Business Funds

**CRITICAL RULE:** **Maintain "Corporate Veil"**

The LLC only protects you if you keep business and personal finances **completely separate**.

**DON'T:**
- ❌ Pay personal expenses from business account
- ❌ Pay business expenses from personal account (after LLC formed)
- ❌ Mix funds in any way
- ❌ Use business account as personal ATM

**DO:**
- ✅ All business expenses from business account/card
- ✅ Pay yourself a "draw" or "salary" (transfer to personal)
- ✅ Keep receipts for everything
- ✅ Document all transactions

### Transition Period (Pre-LLC to Post-LLC)

**Before LLC is formed:**
- You're operating as sole proprietor
- Can pay from personal funds
- **Track these expenses** - they're deductible

**After LLC is formed:**
- Transfer money from personal → business account
- Document as "Owner Contribution"
- Pay all business expenses from business account

**Example:**
```
Personal Account ──$500──> Business Account (Owner Contribution)
Business Account ──$XX──> Google Cloud (Cloud Run + Cloud SQL)
Business Account ──$12──> Namecheap (Domain)
```

### Paying for Existing Services

**Services you're already using:**
1. Google Cloud (Cloud Run + Cloud SQL)
2. Vercel (landing page)
3. Domain registrar
4. Stripe (payment processing)
5. Google Cloud (Gemini API)

**How to transition:**

**Step 1: Update billing info**
- Log into each service
- Go to Billing/Payment settings
- Update company name: "FlashNote LLC"
- Update payment method: Business bank account or business credit card
- Update billing address: LLC address

**Step 2: Update legal entity (if needed)**
- Some services (like Stripe) need to verify LLC
- Upload Articles of Organization
- Provide EIN
- May require 1-2 days for verification

**Example: Updating Stripe**
1. Log into Stripe Dashboard
2. Settings → Business settings
3. Update:
   - Legal business name: FlashNote LLC
   - Business type: Limited Liability Company
   - Tax ID: [Your EIN]
   - Upload: Articles of Organization
4. Settings → Payouts
5. Update bank account to business account
6. Verify with micro-deposits (1-2 days)

### Business Credit Card (Optional)

**Benefits:**
- Separates business expenses automatically
- Builds business credit
- Cashback/rewards on business purchases
- Some offer signup bonuses

**When to get:**
- After business bank account established
- After some business revenue (helps approval)
- Not required immediately

**Good options:**
- Chase Ink Business Cash (5% cashback on office supplies)
- American Express Blue Business Cash (2% cashback everything)
- Capital One Spark Cash (2% cashback everything)

**Approval requirements:**
- Personal credit check (you're guarantor)
- EIN
- Business bank account
- Some business revenue (or $0 revenue + good personal credit)

### Paying Yourself

**How to take money out:**

**Method 1: Owner's Draw (Simple)**
- Transfer money from business → personal account
- Do this periodically (monthly recommended)
- Track as "Owner's Draw" in accounting
- Not a tax deduction (it's your profit)

**Method 2: Salary (S-Corp only)**
- Only if you elect S-Corp status
- Pay yourself W-2 salary
- Reduces self-employment tax
- More complex, requires payroll

**Recommendation for Year 1:** Owner's draw, elect S-Corp later if profitable

**How much to pay yourself:**
- Year 1: Only draw what you need, keep cash in business
- Once profitable: Draw regularly to avoid accumulating too much
- Leave 3-6 months expenses in business account

---

## Tax Obligations

### Federal Taxes

**Tax Structure (Default LLC):**
- LLC is "pass-through" entity
- Profits pass through to your personal tax return
- You pay self-employment tax (15.3%) + income tax

**Required filings:**

**1. Quarterly Estimated Taxes (Form 1040-ES)**
- Due: April 15, June 15, Sept 15, Jan 15
- Pay 90% of expected tax liability
- Based on profit (revenue - expenses)
- Penalties if you underpay

**How to calculate:**
```
Quarterly profit × 30% = Estimated tax payment

Example:
$10,000 profit in Q1
$10,000 × 0.30 = $3,000 quarterly payment
```

**How to pay:**
- IRS Direct Pay: https://www.irs.gov/payments/direct-pay
- Free, directly from bank account
- Or use EFTPS (Electronic Federal Tax Payment System)

**2. Annual Tax Return (Form 1040 + Schedule C)**
- Due: April 15 (next year)
- Schedule C: Business income and expenses
- SE Form: Self-employment tax calculation
- Attached to personal 1040

**Recommendation:** Use TurboTax Self-Employed or hire CPA ($500-1,500)

### California State Taxes

**Required:**

**1. Annual Franchise Tax ($800)**
- Due: April 15 every year
- $800 minimum (even with $0 income)
- First year: Waived if formed after 2/1/2024 (check current law)
- Pay online: https://www.ftb.ca.gov/pay

**How to pay:**
```
Business Account ──$800──> California Franchise Tax Board
Categorize: Taxes - Franchise Tax
```

**2. Quarterly Estimated Taxes**
- If profitable, pay CA income tax quarterly
- Form 540-ES
- Similar to federal

**3. Sales Tax (N/A for SaaS)**
- Digital products like FlashNote are not subject to CA sales tax
- No need to register with CDTFA

### Payroll Taxes (Future)

**If you hire employees:**
- Federal payroll tax withholding
- State payroll tax withholding
- Unemployment insurance
- Workers' comp insurance

**Recommendation:** Use Gusto ($40/month + $6/employee) to handle automatically

### Tax Deductions (Track These!)

**Common business expenses:**
- Server/hosting: Google Cloud, Vercel (~$15-45/month)
- Domain registration ($12/year)
- Stripe fees (2.9% + $0.30 per transaction)
- Google Cloud / LLM API costs
- Legal fees (lawyer, formation)
- Accounting software
- Business insurance (if purchased)
- Office supplies
- Internet/phone (portion used for business)
- Home office (if you have dedicated space)
- Computer/equipment (depreciate over time)
- Marketing/advertising
- Professional development (courses, conferences)

**How to maximize deductions:**
- Save all receipts (Wave app can scan receipts)
- Categorize every expense in Wave
- Document business purpose of mixed-use items
- Keep mileage log if you drive for business

---

## GitHub and IP Protection

### Do You Need to Transfer GitHub Account?

**Short answer: No, but organize properly.**

### Option 1: Keep Personal GitHub, Add LLC as Owner (RECOMMENDED)

**What to do:**
1. Your code already exists in GitHub under your account
2. Add "Copyright FlashNote LLC" to LICENSE file
3. Document IP assignment in writing
4. No need to create new GitHub account

**Why this works:**
- You (Matthew) are the sole owner of FlashNote LLC
- LLC owns the IP, you control the GitHub
- Simpler, no migration needed

**LICENSE file example:**
```
MIT License

Copyright (c) 2024-present FlashNote LLC

Permission is hereby granted, free of charge...
```

### Option 2: Create Organization Account

**What to do:**
1. Create GitHub Organization: "FlashNote"
2. Transfer repository from personal → organization
3. You remain admin/owner
4. Looks more professional

**Cost:** $0 for public repos, $4/user/month for private

**When to do this:**
- If you hire developers (team access)
- If you want professional appearance
- If planning to sell company (cleaner IP)

**How to transfer:**
```
GitHub → Repository Settings → Danger Zone → Transfer Ownership
Transfer to: FlashNote (organization)
```

### Documenting IP Ownership

**Create: IP Assignment Agreement**

**What it says:**
- You (Matthew Nelson) assign all rights to FlashNote code
- FlashNote LLC is the owner of all IP
- Effective date: [LLC formation date]
- Covers: code, designs, trademarks, documentation

**Template:**
```
INTELLECTUAL PROPERTY ASSIGNMENT AGREEMENT

This Agreement is made as of [DATE], between:

ASSIGNOR: Matthew Nelson (individual)

ASSIGNEE: FlashNote LLC

1. Assignment: Assignor hereby assigns to Assignee all right, title,
   and interest in the software application known as "FlashNote",
   including all source code, designs, documentation, and related
   intellectual property.

2. Work Made for Hire: To the extent the Work qualifies as a "work
   made for hire" under copyright law, it is so designated.

3. Prior Work: This assignment covers all Work created from [START DATE]
   to present and all future Work.

Signatures:

_______________________          _______________________
Matthew Nelson (Assignor)        Matthew Nelson, FlashNote LLC (Assignee)
Date: __________                 Date: __________
```

**Where to store:**
- Print, sign, scan → PDF
- Store in: `flashnote-llc/legal/ip-assignment.pdf`
- Keep physical copy in safe place

**Cost:** $0 (self-executed) or $200-500 (lawyer-drafted)

### Protecting Your IP

**What to protect:**
1. **Code** - Already protected by copyright
2. **Name/Logo** - Consider trademark registration
3. **Domain** - Already owned, transfer to LLC
4. **Prompts** - Trade secret (don't publish)

**Trademark Registration (Optional):**
- Cost: $250-350 per class (USPTO)
- Timeline: 6-12 months
- Protects "FlashNote" name in healthcare software category
- Not required initially, consider after traction

**Trade Secrets:**
- PT-specific prompts are valuable IP
- Don't publish in public repos
- Mark as "Confidential" in docs
- If hiring contractors, require NDA

---

## Legal Protection Within LLC

### How LLC Protects You

**What LLC protects (The "Corporate Veil"):**

**Scenario 1: HIPAA/HITECH violation (e.g., PHI breach)**
- ✅ HHS OCR can audit and fine FlashNote LLC directly (HITECH Act)
- ✅ Customers can sue FlashNote LLC
- ✅ LLC assets at risk (bank account, equipment)
- ✅ Your personal assets protected (house, car, savings)
- ⚠️ HITECH penalties: $141–$2,134,831 per violation category/year depending on culpability

**Scenario 2: Business debt**
- ✅ Vendor sues for unpaid bill
- ✅ LLC is liable, not you personally
- ✅ Your personal credit not affected

**Scenario 3: Product liability**
- ✅ Someone claims FlashNote caused harm
- ✅ LLC is defendant, not you
- ✅ Your personal assets protected

### How to MAINTAIN Protection ("Piercing the Veil")

**The LLC ONLY protects you if you treat it as a separate entity.**

**DO THESE THINGS (Critical):**

1. **Separate Finances**
   - ✅ All business expenses through business account
   - ✅ Never mix personal and business money
   - ✅ Pay yourself via official "draw"
   - ✅ Document everything

2. **Sign Contracts as LLC**
   - ✅ Sign: "FlashNote LLC by Matthew Nelson, Member"
   - ❌ Don't sign: "Matthew Nelson"
   - Use LLC name on all agreements

3. **Maintain Operating Agreement**
   - ✅ Keep operating agreement on file
   - ✅ Follow its procedures
   - ✅ Document major decisions

4. **Hold Annual Meetings (Optional but Recommended)**
   - Single-member LLC doesn't require meetings
   - But document major decisions in writing
   - "Meeting minutes" even if just you

5. **File Annual Reports**
   - California: Statement of Information ($0, due 90 days after formation, then every 2 years)
   - File on time, every time

6. **Adequate Capitalization**
   - Don't operate LLC with $0 in bank account
   - Keep enough money to cover reasonable expenses
   - $500-1,000 minimum

7. **Insurance (Recommended)**
   - Professional liability (E&O): $500-2,000/year
   - Cyber liability: $500-1,500/year
   - Not required, but adds protection layer

### What LLC Does NOT Protect

**You're still personally liable for:**
- ❌ Your own negligence or wrongdoing
- ❌ Taxes you fail to pay
- ❌ Personal guarantees on loans
- ❌ Fraud or intentional harm

**Example:**
- If YOU personally leak PHI due to negligence → You're liable
- If YOUR CODE has a bug that leaks PHI → LLC is liable, you're protected

### Operating Agreement

**What is it:**
- Internal document defining LLC rules
- Not filed with state (keep in your records)
- Describes ownership, management, profit distribution

**Required in California:** No, but highly recommended

**Get a template:**
- LegalZoom: $99
- Rocket Lawyer: Free with membership ($40/month)
- Northwest Registered Agent: Included with service
- Online free templates: Google "single-member LLC operating agreement California"

**What it should include:**
- Member: Matthew Nelson (100% ownership)
- Management: Member-managed (you make decisions)
- Capital contribution: $[amount you deposit]
- Distributions: Profits distributed to you
- Dissolution: Process if LLC closes

**Store it:**
- `flashnote-llc/legal/operating-agreement.pdf`
- Keep physical copy in safe location

---

## Ongoing Compliance

### Annual Requirements

**California:**
- [ ] Franchise Tax payment: $800 (due April 15)
- [ ] Statement of Information: $0 (due within 90 days of formation, then every 2 years)
- [ ] Quarterly estimated taxes (if profitable)
- [ ] Annual tax return (April 15)

**Federal:**
- [ ] Quarterly estimated taxes (if profitable)
- [ ] Annual tax return (April 15)
- [ ] Form 1099-NEC if you pay contractors >$600 (due Jan 31)

### Compliance Checklist

**Monthly:**
- [ ] Reconcile bank account in Wave
- [ ] Categorize all transactions
- [ ] Save receipts
- [ ] Review cash flow

**Quarterly:**
- [ ] Calculate estimated taxes
- [ ] Pay estimated taxes (IRS + CA FTB)
- [ ] Review P&L statement
- [ ] Adjust budget if needed

**Annually:**
- [ ] File federal tax return (1040 + Schedule C)
- [ ] File California tax return (540)
- [ ] Pay franchise tax ($800)
- [ ] Update Statement of Information (every 2 years)
- [ ] Review operating agreement
- [ ] Review insurance policies

### Using a CPA (Recommended)

**When to hire:**
- Once profitable ($10k+ revenue)
- When taxes get complex
- If you're spending >10 hours on bookkeeping

**Services:**
- Monthly bookkeeping: $200-500/month
- Tax preparation: $500-1,500/year
- Tax planning: $500-2,000/session
- Audit support: $2,000-10,000 (if needed)

**Finding a CPA:**
- Ask for referrals (other small business owners)
- Look for: Small business experience + healthcare/SaaS experience
- Interview 2-3 before choosing

**Cost/benefit:**
- CPA costs: $1,500-3,000/year
- Tax savings from optimization: $2,000-10,000/year
- Time savings: 50-100 hours/year
- Worth it once making $30k+/year

---

## Summary Checklist

### Formation Phase (Week 1-2)

- [ ] Choose LLC name, check availability
- [ ] Choose registered agent (professional service recommended)
- [ ] File Articles of Organization with California ($70)
- [ ] Wait for approval (3-7 days)
- [ ] Get EIN from IRS (free, instant)
- [ ] Draft operating agreement (template)
- [ ] Open business bank account (Mercury recommended)
- [ ] Initial deposit ($500-1,000)
- [ ] Set up accounting software (Wave)
- [ ] Connect bank account to accounting

### Organization Phase (Week 2-3)

- [ ] Update LICENSE file with LLC copyright
- [ ] Create IP assignment agreement (self-execute or lawyer)
- [ ] Transfer domain registration to LLC name
- [ ] Update service providers (Google Cloud, Vercel, Stripe)
- [ ] Update payment methods to business account
- [ ] Get business credit card (optional)
- [ ] Set up receipt scanning (Wave mobile app)
- [ ] Create expense tracking system

### Compliance Phase (Ongoing)

- [ ] File Statement of Information (within 90 days)
- [ ] Register with CA EDD (if hiring employees - N/A for now)
- [ ] Set up quarterly tax payment reminders
- [ ] Track all business expenses
- [ ] Separate personal and business finances
- [ ] Document major business decisions
- [ ] Keep LLC records organized
- [ ] Get business insurance quotes

### Launch Phase (Week 3-4)

- [ ] Update website footer: "© 2024 FlashNote LLC"
- [ ] Update Terms of Service with LLC entity name
- [ ] Update Privacy Policy with LLC entity name
- [ ] Update BAA with LLC entity name and EIN
- [ ] Update Stripe onboarding (if not done)
- [ ] Test payment flow with LLC bank account
- [ ] Ready to accept customers!

---

## Cost Summary

| Item | Cost | When | Frequency |
|------|------|------|-----------|
| CA LLC Formation | $70 | Formation | One-time |
| Registered Agent | $125 | Formation | Annual |
| EIN | $0 | Formation | One-time |
| Operating Agreement | $0-100 | Formation | One-time |
| Business Bank Account | $0 | Week 1 | Monthly ($0 with Mercury) |
| Accounting Software | $0 | Week 1 | Monthly ($0 with Wave) |
| Business Credit Card | $0 | Month 2 | Annual ($0 with right card) |
| IP Assignment | $0 | Week 2 | One-time |
| CA Franchise Tax | $800 | Year 1 | Annual |
| CPA (optional) | $500-1,500 | Tax time | Annual |
| Business Insurance | $1,400-4,300 | Month 6 | Annual |

**Year 1 Total (Minimal):** $995 ($70 + $125 + $800)
**Year 1 Total (With CPA):** $1,500-2,500
**Year 1 Total (With Insurance):** $2,400-4,800

---

## Common Mistakes to Avoid

1. ❌ **Mixing personal and business finances** → Pierces corporate veil
2. ❌ **Not tracking expenses** → Miss tax deductions
3. ❌ **Paying business expenses from personal account** → Accounting nightmare
4. ❌ **Forgetting estimated quarterly taxes** → Penalties and interest
5. ❌ **Not filing Statement of Information** → $250 penalty
6. ❌ **Operating without EIN** → Can't open bank account
7. ❌ **Using personal credit card for business** → Hard to track, no separation
8. ❌ **Not getting BAA signed by customers** → HIPAA/HITECH violation (direct liability as business associate)
9. ❌ **Forgetting $800 CA franchise tax** → Penalties add up
10. ❌ **Not documenting IP ownership** → Issues when selling company

---

## Questions?

**Before LLC formation:**
- Talk to CPA or lawyer if complex situation
- Budget $500 for professional consultation if unsure

**During formation:**
- CA Secretary of State: (916) 657-5448
- IRS EIN help: (800) 829-4933

**After formation:**
- Keep this guide handy
- Join r/smallbusiness on Reddit
- Consider SCORE mentorship (free)

---

## Next Steps

1. **Read this entire guide**
2. **Decide: LLC now or wait?**
   - If accepting money: DO IT NOW
   - If still building: Can wait, but start soon
3. **If proceeding:**
   - Day 1: File LLC formation
   - Day 3-7: Get EIN
   - Week 2: Open bank account
   - Week 2: Transfer $500-1,000 to business account
   - Week 3: Update all service providers
   - Week 3: Start tracking all expenses in Wave
4. **Update legal documents** (from PRE_LAUNCH_LEGAL_COMPLIANCE.md)
5. **Launch beta** (legally protected!)

**Good luck! You've got this. 🚀**

---

*This guide is for informational purposes only and does not constitute legal or tax advice. Consult with licensed professionals for your specific situation.*
