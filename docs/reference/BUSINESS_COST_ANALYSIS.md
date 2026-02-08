# FlashNote Business Cost Analysis

**Date:** February 2026 (Updated)
**Last Revised:** February 4, 2026
**Purpose:** Comprehensive cost breakdown and financial projections for operating FlashNote

---

## Executive Summary

FlashNote is a highly capital-efficient SaaS business with **93-94% gross margins** at scale. The dominant cost driver remains **Stripe payment processing fees** ($1.14/transaction on $29/mo subscription), though LLM costs are more significant than initially estimated due to realistic usage patterns.

**Key Update (Feb 2026):** Usage assumptions revised from 20 notes/month to **440 notes/month** (20 notes/day × 22 working days) based on realistic PT workflow analysis. Token counts updated to reflect actual prompt implementation.

| Metric | Value |
|--------|-------|
| Target Price | $29/month |
| Cost Per User (at 100 users) | ~$1.69/month |
| Gross Margin | ~94.2% |
| Break-even Users | ~6-8 users |
| MRR Target | $3,000 (100 users) |

---

## 1. Starting/Setup Costs (One-Time)

### Essential Setup

| Item | Cost | Notes |
|------|------|-------|
| Domain Registration | $12-15/year | flashnote.co |
| Chrome Web Store Developer | $5 (one-time) | Required to publish extension |
| Stripe Account | $0 | Free to create, pay-as-you-go |
| Google Cloud Account | $0 | Free tier + pay-as-you-go |
| Render/Vercel Accounts | $0 | Free to create |
| **Total Essential** | **~$20** | |

### Development Infrastructure (First Month)

| Item | Cost | Notes |
|------|------|-------|
| Render Web Service | $7 | Backend API hosting |
| Render PostgreSQL | $7 | Database hosting |
| Vercel | $0 | Landing page (free tier) |
| Gemini API | $0-5 | Development testing (free tier available) |
| **Total First Month Infra** | **~$14-19** | |

### Optional but Recommended

| Item | Cost | Notes |
|------|------|-------|
| Professional Logo Design | $50-200 | Fiverr/99designs |
| Legal Document Templates | $0-500 | See Legal Costs section |
| Error Monitoring (Sentry) | $0 | Free tier sufficient for launch |
| **Total Optional** | **$0-700** | |

### Total Starting Costs

| Scenario | Total |
|----------|-------|
| **Bootstrapped Minimum** | ~$35 |
| **Professional Launch** | ~$200-500 |
| **With Legal Basics** | ~$700-1,500 |

---

## 2. Recurring Infrastructure Costs

### Monthly Infrastructure (Fixed)

| Service | Cost/Month | Purpose |
|---------|------------|---------|
| Render Web Service | $7 | Backend API |
| Render PostgreSQL | $7 | Database |
| Vercel | $0 | Landing page (free tier) |
| Domain Renewal | ~$1 | ($12/year amortized) |
| **Total Fixed** | **~$15/month** | |

### Variable Costs (Scale with Usage)

| Cost | Per Unit | At 100 Users | At 1,000 Users |
|------|----------|--------------|----------------|
| Gemini API | ~$0.00090/note | $39.60/mo* | $396/mo* |
| Stripe Processing | 2.9% + $0.30/txn | $114/mo | $1,140/mo |
| Database Growth | Negligible | $0 | $0 |
| Bandwidth | Included | $0 | $0 |

*Assumes 440 notes/user/month (20 notes/day × 22 working days) - realistic for full-time PT

### Cost Scaling by User Count

| Users | Fixed | LLM (440 notes/mo) | Stripe | Total Cost | Revenue | Gross Margin |
|-------|-------|-------------------|--------|------------|---------|--------------|
| 10 | $15 | $3.96 | $11.40 | $30.36 | $290 | 89.5% |
| 50 | $15 | $19.80 | $57.00 | $91.80 | $1,450 | 93.7% |
| 100 | $15 | $39.60 | $114.00 | $168.60 | $2,900 | 94.2% |
| 500 | $15 | $198.00 | $570.00 | $783.00 | $14,500 | 94.6% |
| 1,000 | $15 | $396.00 | $1,140.00 | $1,551.00 | $29,000 | 94.7% |

**Note:** LLM costs assume current prompt implementation at $0.00090/note. See "Prompt Verbosity Impact" section for sensitivity analysis.

---

## 3. LLM/API Costs Deep Dive

### Gemini 2.5 Flash Pricing (Current - February 2026)

| Token Type | Cost per 1M Tokens |
|------------|-------------------|
| Input Tokens | $0.15 |
| Output Tokens | $0.60 |

### Per-Note Cost Calculation (Actual Implementation)

Based on the current `pt-prompts.ts` implementation, actual token usage is higher than initial estimates due to comprehensive billing rules, anti-hallucination safeguards, and structured JSON output:

| Component | Initial Estimate | Actual (Feb 2026) | Cost |
|-----------|------------------|-------------------|------|
| System Prompt (with billing/goals/alerts) | ~800 | **~2,000** | $0.00030 |
| Note Type Instructions | ~150 | ~150 | $0.0000225 |
| Patient Context | ~100 | ~75 | $0.0000113 |
| Clinician Notes | ~150 | ~200 | $0.00003 |
| **Total Input** | **~1,200** | **~2,425** | **$0.00036** |
| **Output (SOAP + billing JSON + goals)** | **~650** | **~900** | **$0.00054** |
| **Total Per Note** | **~1,850** | **~3,325** | **~$0.00090** |

### Monthly LLM Cost Projections (Updated)

Based on realistic PT usage of **20 notes/day** (440 notes/month):

| Scenario | Notes/User/Mo | Users | Monthly LLM Cost |
|----------|---------------|-------|------------------|
| Part-time PT | 200 | 100 | $18.00 |
| **Full-time PT (typical)** | **440** | **100** | **$39.60** |
| High-volume PT | 660 | 100 | $59.40 |
| Power User (40/day) | 880 | 10 | $7.92 |

### Prompt Verbosity Impact Analysis

If we enhance prompts for more creative/detailed output:

| Prompt Size | Input Tokens | Output Tokens | Cost/Note | 440 Notes/Mo |
|-------------|--------------|---------------|-----------|--------------|
| Current | 2,425 | 900 | $0.00090 | $0.40/user |
| 2x Verbose | 4,500 | 1,200 | $0.00140 | $0.62/user |
| 3x Verbose | 6,500 | 1,500 | $0.00190 | $0.84/user |
| 4x Verbose (max practical) | 8,500 | 2,000 | $0.00248 | $1.09/user |

### Key Insight

**LLM costs remain manageable even with aggressive usage and verbose prompts.** At 1,000 users doing 440 notes/month each with 2x verbose prompts, total LLM costs are ~$616/month — still less than Stripe fees (~$1,140/month). The risk of LLM cost overrun is minimal.

---

## 4. Payment Processing Analysis

### Stripe Fee Structure

| Component | Rate |
|-----------|------|
| Transaction Fee | 2.9% |
| Per-Transaction Fee | $0.30 |

### Per-Transaction Cost by Plan

| Plan | Price | Stripe Fee | Net Revenue |
|------|-------|------------|-------------|
| Monthly ($29) | $29.00 | $1.14 | $27.86 |
| Annual ($290) | $290.00 | $8.71 | $281.29 |

### Monthly vs Annual Impact

| Plan | Transactions/Year | Stripe Cost/Year | Revenue/Year | Net/Year |
|------|-------------------|------------------|--------------|----------|
| Monthly | 12 | $13.68 | $348 | $334.32 |
| Annual | 1 | $8.71 | $290 | $281.29 |

**Observation:** Monthly billing results in **$53 more revenue** per user per year, but **$4.97 more in Stripe fees**. Monthly is still more profitable despite higher processing costs.

### Optimization Strategies

1. **Encourage Annual Plans**: Offer 2 months free ($290 = 10 months) to reduce transaction volume
2. **Consider Stripe Alternatives**:
   - Paddle: 5% + $0.50 (higher, but handles tax/VAT)
   - LemonSqueezy: 5% + $0.50 (similar to Paddle)
   - Stripe is still cheapest for US-only operation

---

## 5. Auxiliary Business Costs

### Legal & Compliance

| Item | Cost | Frequency | Notes |
|------|------|-----------|-------|
| **LLC Formation** | $50-500 | One-time | State-dependent (Wyoming: $100, Delaware: $90, California: $70) |
| LLC Annual Report | $25-800 | Annual | State-dependent (Wyoming: $60, Delaware: $300, CA: $800 min) |
| Registered Agent | $50-300 | Annual | Required for privacy/compliance |
| **Privacy Policy** | $0-300 | One-time | Template or lawyer-reviewed |
| **Terms of Service** | $0-300 | One-time | Template or lawyer-reviewed |
| **BAA Template** | $0-500 | One-time | Required for HIPAA, template or lawyer |
| BAA Review (per customer) | $0-200 | Per enterprise | Usually only enterprise customers request custom BAAs |
| **Lawyer Consultation** | $200-500/hr | As needed | HIPAA compliance review, contracts |

### Recommended Legal Budget

| Approach | Initial Cost | Annual Cost | Notes |
|----------|--------------|-------------|-------|
| **Bootstrapped** | $200-400 | $100-200 | LLC + templates + registered agent |
| **Professional** | $1,000-2,000 | $300-500 | Lawyer-reviewed docs + LLC |
| **Enterprise-Ready** | $3,000-5,000 | $1,000-2,000 | Full legal review + custom BAAs |

### Insurance (Recommended for Healthcare)

| Type | Annual Cost | Notes |
|------|-------------|-------|
| Professional Liability (E&O) | $500-2,000 | Covers claims of negligence |
| Cyber Liability | $500-1,500 | Covers data breaches |
| General Business | $400-800 | Basic liability |

**Note:** Insurance is optional early-stage but becomes important as you scale and sign enterprise customers.

### HIPAA-Specific Costs

| Item | Cost | Notes |
|------|------|-------|
| Google Cloud BAA | $0 | Included with Vertex AI |
| Vertex AI Migration | $0 extra | Same pricing as Gemini API |
| HIPAA Security Assessment | $2,000-10,000 | Optional, for enterprise sales |
| Penetration Testing | $3,000-15,000 | Required for some enterprise customers |
| SOC 2 Type II Audit | $20,000-50,000 | Only if pursuing large enterprise deals |

---

## 6. Tax Burden Analysis

### Federal Tax (LLC/S-Corp)

| Income Bracket (2024) | Rate | Applies To |
|-----------------------|------|------------|
| $0 - $11,600 | 10% | First $11,600 |
| $11,601 - $47,150 | 12% | |
| $47,151 - $100,525 | 22% | |
| $100,526 - $191,950 | 24% | |
| $191,951 - $243,725 | 32% | |

### Self-Employment Tax

| Tax | Rate | Notes |
|-----|------|-------|
| Social Security | 12.4% | On first $168,600 (2024) |
| Medicare | 2.9% | On all income |
| Additional Medicare | 0.9% | Income over $200k |
| **Total SE Tax** | **15.3%** | Until Social Security cap |

### Estimated Tax at Various Revenue Levels

| Annual Revenue | Expenses* | Net Profit | SE Tax | Income Tax** | Total Tax | Effective Rate |
|----------------|-----------|------------|--------|--------------|-----------|----------------|
| $3,000 | $1,800 | $1,200 | $184 | $120 | $304 | 25.3% |
| $12,000 | $2,400 | $9,600 | $1,469 | $1,152 | $2,621 | 27.3% |
| $36,000 | $4,200 | $31,800 | $4,865 | $4,452 | $9,317 | 29.3% |
| $100,000 | $8,000 | $92,000 | $14,076 | $14,552 | $28,628 | 31.1% |

*Expenses include infrastructure, Stripe fees, legal, etc.
**Assumes single filer, no other income, standard deduction

### Tax Optimization Strategies

1. **S-Corp Election**: Once profitable ($40k+), elect S-Corp status to reduce SE tax
2. **Retirement Contributions**: SEP-IRA allows up to 25% of net earnings (max $69,000)
3. **Health Insurance Deduction**: Self-employed can deduct 100% of premiums
4. **Home Office Deduction**: Legitimate if you have dedicated workspace
5. **Equipment Depreciation**: Computers, software, etc. are deductible

### Quarterly Estimated Payments

| Quarter | Due Date | Payment (Example: $36k/yr revenue) |
|---------|----------|-----------------------------------|
| Q1 | April 15 | ~$2,330 |
| Q2 | June 15 | ~$2,330 |
| Q3 | September 15 | ~$2,330 |
| Q4 | January 15 | ~$2,330 |

---

## 7. Cost Per User Analysis

### Marginal Cost Per User (at 100 users, 440 notes/month)

| Cost Category | $/User/Month | % of Total |
|---------------|--------------|------------|
| LLM API (440 notes) | $0.40 | 23.4% |
| Stripe Processing | $1.14 | 66.9% |
| Infrastructure (shared) | $0.15 | 8.8% |
| **Total Marginal Cost** | **$1.69** | 100% |

### With Enhanced Prompts (2x Verbose)

| Cost Category | $/User/Month | % of Total |
|---------------|--------------|------------|
| LLM API (440 notes, 2x verbose) | $0.62 | 32.3% |
| Stripe Processing | $1.14 | 59.4% |
| Infrastructure (shared) | $0.15 | 7.8% |
| **Total Marginal Cost** | **$1.91** | 100% |

### Fully-Loaded Cost Per User (Including Overhead)

| Cost Category | Monthly (100 users) | Per User |
|---------------|---------------------|----------|
| Marginal Costs | $169 | $1.69 |
| Legal (amortized) | $50 | $0.50 |
| Insurance (amortized) | $100 | $1.00 |
| Your Time (if valued) | $2,000 | $20.00 |
| **Total Loaded Cost** | **$2,319** | **$23.19** |

### Unit Economics

| Metric | Value |
|--------|-------|
| Customer Acquisition Cost (CAC) | TBD (depends on marketing) |
| Lifetime Value (LTV) at 5% churn | $580 (20 months) |
| LTV at 10% churn | $290 (10 months) |
| LTV/CAC Target | > 3:1 |
| Maximum CAC at 3:1 | $96 (5% churn) / $48 (10% churn) |

---

## 8. Break-Even Analysis

### Monthly Break-Even

| Cost Component | Monthly |
|----------------|---------|
| Fixed Infrastructure | $15 |
| Legal (amortized) | $50 |
| Insurance (amortized) | $100 |
| **Total Fixed** | **$165** |

| Revenue per User | $29 |
| Variable Cost per User | $1.69 |
| **Contribution Margin** | **$27.31** |

**Break-Even Users = Fixed Costs / Contribution Margin**

| Scenario | Fixed Costs | Break-Even Users |
|----------|-------------|------------------|
| Bare Minimum (infra only) | $15 | 1 user |
| With Legal/Insurance | $165 | 6 users |
| With $2k/mo founder salary | $2,165 | 80 users |

### Monthly Revenue Milestones (Updated for 440 notes/user/month)

| Users | MRR | Net After Costs | Annual Net |
|-------|-----|-----------------|------------|
| 10 | $290 | $95 | $1,140 |
| 25 | $725 | $502 | $6,024 |
| 50 | $1,450 | $1,093 | $13,116 |
| 100 | $2,900 | $2,467 | $29,604 |
| 250 | $7,250 | $6,422 | $77,064 |
| 500 | $14,500 | $13,302 | $159,624 |

---

## 9. Pricing Recommendations

### Current Pricing Analysis

| Plan | Price | Competitor Range | Position |
|------|-------|------------------|----------|
| Monthly | $29 | $75-99 | 60-70% cheaper |
| Annual | $290 | $700-1,100 | 60-70% cheaper |

### Pricing Options

#### Option 1: Keep Current ($29/mo)
- **Pros**: Strong competitive positioning, low barrier to entry
- **Cons**: May leave money on table, signals "budget" option
- **Best for**: Volume-focused growth, market penetration

#### Option 2: Moderate Increase ($39/mo)
- **Pros**: Still 50% cheaper than competitors, higher margins
- **Cons**: Slightly higher barrier to entry
- **Break-even**: 5 users instead of 6

#### Option 3: Premium Position ($49/mo)
- **Pros**: 40% competitor discount still compelling, much higher margins
- **Cons**: May slow adoption
- **Break-even**: 4 users instead of 6

### Recommended Pricing Strategy

**Start at $29/mo** with these future options:

1. **Grandfather early users** at $29/mo forever (loyalty + testimonials)
2. **Raise to $39/mo** after first 100 users
3. **Consider $49/mo** if quality/features justify it
4. **Offer annual at 2 months free** ($290 = 10 months)

### Alternative: Usage-Based Tier

| Tier | Price | Notes/Month | Best For |
|------|-------|-------------|----------|
| Starter | $19/mo | 30 notes | Part-time/per-diem PTs |
| Pro | $29/mo | Unlimited | Standard PT |
| Team | $99/mo | Unlimited × 5 users | Small clinics |

---

## 10. Financial Projections (12 Months)

### Conservative Scenario (Slow Growth)

| Month | New Users | Total Users | MRR | Expenses | Net |
|-------|-----------|-------------|-----|----------|-----|
| 1 | 5 | 5 | $145 | $165 | -$20 |
| 2 | 5 | 10 | $290 | $175 | $115 |
| 3 | 5 | 14 | $406 | $183 | $223 |
| 4 | 5 | 18 | $522 | $190 | $332 |
| 5 | 8 | 25 | $725 | $203 | $522 |
| 6 | 8 | 32 | $928 | $215 | $713 |
| 7 | 10 | 40 | $1,160 | $230 | $930 |
| 8 | 10 | 48 | $1,392 | $244 | $1,148 |
| 9 | 12 | 57 | $1,653 | $260 | $1,393 |
| 10 | 12 | 66 | $1,914 | $276 | $1,638 |
| 11 | 15 | 78 | $2,262 | $296 | $1,966 |
| 12 | 15 | 90 | $2,610 | $316 | $2,294 |

**Year 1 Total (Conservative)**: ~$11,254 net profit

### Moderate Scenario (Steady Growth)

| Month | New Users | Total Users | MRR | Net |
|-------|-----------|-------------|-----|-----|
| 1 | 10 | 10 | $290 | $115 |
| 3 | 15 | 40 | $1,160 | $930 |
| 6 | 20 | 95 | $2,755 | $2,460 |
| 9 | 25 | 175 | $5,075 | $4,600 |
| 12 | 30 | 280 | $8,120 | $7,500 |

**Year 1 Total (Moderate)**: ~$42,000 net profit

### Aggressive Scenario (Strong Product-Market Fit)

| Month | New Users | Total Users | MRR | Net |
|-------|-----------|-------------|-----|-----|
| 1 | 20 | 20 | $580 | $420 |
| 3 | 40 | 100 | $2,900 | $2,600 |
| 6 | 60 | 280 | $8,120 | $7,500 |
| 9 | 80 | 500 | $14,500 | $13,500 |
| 12 | 100 | 800 | $23,200 | $21,800 |

**Year 1 Total (Aggressive)**: ~$140,000 net profit

---

## 11. Risk Factors & Mitigation

### Financial Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| High Churn | Lower LTV | Medium | Focus on quality, gather feedback |
| Gemini Price Increase | Higher costs | Low | 10x increase → $0.009/note, still manageable |
| Very High Usage (40 notes/day) | Higher LLM costs | Medium | Still only ~$0.80/user/month |
| Stripe Price Increase | Higher costs | Very Low | Well-established pricing |
| Competition Undercuts | Price pressure | Medium | Focus on quality & niche |

### Operational Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| HIPAA Breach | Catastrophic | Low | No PHI storage, audit logging |
| API Outage (Gemini) | Service down | Low | Error handling, retry logic |
| Chrome Store Removal | Distribution loss | Very Low | Follow guidelines strictly |

### Cost Containment Recommendations

1. **Stay on free tiers** as long as possible (Vercel, Sentry, etc.)
2. **Avoid premature optimization** of infrastructure
3. **Use templates** for legal documents initially
4. **Delay insurance** until you have paying customers
5. **Don't hire** until MRR covers salary + 20% buffer

---

## 12. Summary & Recommendations

### Key Takeaways

1. **Capital Efficient**: Break-even at 6 users with all overhead
2. **High Margins**: 94%+ gross margin at scale (even with realistic usage)
3. **Manageable LLM Costs**: Even at 440 notes/month with verbose prompts, LLM costs are ~$0.40-0.62/user
4. **Stripe Still Dominates**: Payment processing is 60-67% of marginal costs
5. **Competitive Pricing**: 60% cheaper than alternatives at $29/mo
6. **Prompt Flexibility**: Can enhance prompts significantly without major cost impact

### Recommended Launch Budget

| Category | Amount | Notes |
|----------|--------|-------|
| Essential Setup | $35 | Domain + Chrome Store |
| 3 Months Infrastructure | $45 | Buffer for growth |
| Legal Basics | $300 | LLC + templates |
| Contingency | $120 | 20% buffer |
| **Total Launch Capital** | **$500** | |

### Pricing Recommendation

**Launch at $29/month** with 14-day free trial, then:
- Grandfather early users forever
- Raise to $39/month after 100 users
- Offer annual plan at $290 (2 months free)

### First Year Targets

| Milestone | Target | Timeframe |
|-----------|--------|-----------|
| First Paying Customer | 1 user | Month 1-2 |
| Break-Even | 6 users | Month 2-3 |
| $1,000 MRR | 35 users | Month 4-6 |
| $3,000 MRR | 100 users | Month 8-12 |

---

---

## Revision History

| Date | Change |
|------|--------|
| Feb 4, 2026 | Major update: Revised usage from 20 to 440 notes/month (20/day × 22 days); Updated token counts based on actual pt-prompts.ts implementation; Added prompt verbosity sensitivity analysis |
| Feb 2026 | Initial document |

---

*This analysis is based on current pricing and market conditions as of February 2026. Costs and market dynamics may change. Consult with a CPA for tax advice specific to your situation.*
