# AI Medical Scribe Competitive Analysis

**Date:** February 16, 2026
**Purpose:** Comprehensive market analysis of the AI medical scribe/clinical documentation space

---

## Executive Summary

The AI medical scribe market is experiencing explosive growth, projected to reach $153M by 2031 (6.2% CAGR). The market is highly fragmented with intense competition between enterprise-focused solutions (Abridge, DAX Copilot, Suki) and SMB/independent practice tools (Freed, Heidi, Sunoh).

**Key Findings:**
- **Market Leaders:** Abridge ($5.3B valuation, $100M ARR) and DAX Copilot (Nuance/Microsoft) control nearly two-thirds of the $600M market
- **Pricing Range:** $19-$600/month per provider, with enterprise averaging $300-600/mo and SMB tools at $19-150/mo
- **Specialty Segmentation:** Mental health/behavioral health is the most crowded sub-market with 10+ dedicated competitors. Physical therapy has 6+ dedicated tools plus generalists — more competitive than initially assumed, but no dominant leader
- **PT Differentiator:** Nearly all PT competitors use ambient recording; FlashNote's shorthand text input model is genuinely different
- **Adoption Rate:** ~1 in 5 providers at full rollout, 2 in 5 in pilot phase. When widely available, adoption rates reach 20-50%
- **ROI Drivers:** 2-3 hours saved daily on documentation, 15-50% reduction in documentation time, ability to see more patients

---

## Market Size & Segmentation

### Overall Market
- **AI Medical Scribe Market:** $153M projected by 2031, growing at 6.2% CAGR
- **AI in Healthcare (Broader):** $56B in 2026, projected to reach $1.03T by 2034
- **AI in Mental Health:** $1.45-1.71B in 2024/2025, projected to reach $9-25B by 2033/2034 (23-32% CAGR)

### Market Segmentation

**By Customer Type:**
- **Enterprise (54.44% share):** Hospitals, large health systems with 100+ providers. High patient volumes, complex workflows, stringent documentation requirements. Willing to pay $300-600/mo per provider
- **SMB:** Independent practices, small clinics (2-50 providers). Sensitive to pricing, need simple implementation. Prefer $20-150/mo per provider
- **Individual Practitioners:** Solo providers, locum tenens. Most price-sensitive segment

**By Specialty:**
- **General Medicine/Primary Care:** Largest segment, highest accuracy due to abundant training data
- **Mental Health/Behavioral Health:** Fastest-growing specialty segment. Dedicated market with 10+ specialized competitors
- **Specialty Medicine:** (Cardiology, oncology, etc.) Premium segment requiring specialty-specific terminology and workflows
- **Physical Therapy:** Emerging segment with some specialized solutions but less mature than mental health market

**By Documentation Type:**
- **General Documentation:** Largest current segment, most adopted
- **Specialty Documentation:** Fastest-growing CAGR due to rising demand for tailored solutions addressing unique workflows, terminology, and regulatory requirements

### Geographic Trends
- **U.S.-Dominant:** Most competitors focused on U.S. market due to regulatory complexity
- **International Expansion:** Heidi Health (Australia) and Lyrebird Health (Australia) expanding globally
- **Multi-Language Support:** Heidi (110+ languages), TheraPro (50+ languages), Freed (14+ languages)

---

## Competitive Landscape Overview

### Market Structure
The market is **highly fragmented** with:
- 2 dominant enterprise players (Abridge, DAX Copilot)
- 2 heavily-funded enterprise ambient AI platforms (Ambience Healthcare, Athelas)
- 3-5 mid-market players (Suki, Freed, Heidi)
- Emerging multi-specialty players (Twofold Health — early stage but aggressive on content marketing and pricing)
- 15+ behavioral health specialty players
- 6+ PT-specific players (ScribePT, Comprehend, Prediction Health, HippoScribe, Tapt Health, and others)
- Emerging threat: Epic's native AI charting tool (launched August 2025)
- Emerging threat: athenaAmbient bundled free with athenahealth EHR (February 2026)

### Competitive Positioning Map

```
Price (Monthly)
   High ($300-600) │ DAX Copilot    Abridge        Suki        Ambience
                   │    (Enterprise)  (Enterprise)  (Enterprise) ($243M raised)
                   │
   Mid ($100-300)  │ Eleos Health    Sunoh          Freed
                   │  (Behavioral)                   Heidi
                   │ JotPsych        Prediction     Athelas
                   │  (Behavioral)    Health (PT)    ($6B, PT+Gen)
                   │
   Low ($19-99)    │ Mentalyc        Berries        Upheal
                   │  (Mental)        (Mental)      (Mental)
                   │ AutoNotes       Quill          Blueprint
                   │  (Therapy)       (Therapy)     (Therapy)
                   │ ScribePT        Comprehend     Twofold
                   │  (PT)            (PT)          (Multi-Specialty)
                   │
                   └────────────────────────────────────────
                        Specialty-Specific ← → General Medicine
```

---

## Detailed Competitor Analysis

## 1. Enterprise Market Leaders

### Abridge (Market Leader)

**Overview:** Generative AI platform for clinical conversations, the clear enterprise market leader

**Pricing:**
- ~$2,500 per clinician/year ($208/mo)
- Mid-range estimates: $300-500/mo depending on contract terms

**Funding & Scale:**
- **Valuation:** $5.3B (June 2025, up 93% from $2.75B in Feb 2025)
- **Recent Funding:** $300M Series E (June 2025) led by Andreessen Horowitz
- **Revenue:** $100M ARR (May 2025), up from $60M at end of 2024
- **Contracted ARR:** $117M (Q1 2025)
- **Investors:** Lightspeed, Bessemer, Redpoint, Spark Capital, Kaiser Permanente Ventures, CVS Health Ventures, NVIDIA (NVentures)

**Notable Features:**
- Deepest EHR integration (embedded directly into Epic, Cerner, Athena workflows)
- Enterprise-grade security, governance, and compliance
- Notes appear automatically in correct EHR fields without provider action
- Real-time prior authorization integration (partnership with Highmark Health announced Aug 2025)

**Target Market:** Large health systems on Epic/Cerner
- Kaiser Permanente: 24,600 physicians across 40 hospitals, 600 clinics
- Mayo Clinic: 2,000+ physicians plus nursing pilots
- Johns Hopkins, Duke Health, UPMC, Yale New Haven
- 90+ publicly disclosed enterprise customers

**Market Position:** Enterprise leader with strongest EHR integration. Positioned as essential infrastructure for large health systems.

---

### DAX Copilot by Nuance/Microsoft

**Overview:** Pioneer in ambient AI scribes, now owned by Microsoft. Deepest EHR integration available.

**Pricing:**
- **Standard:** $369/mo per provider + $700 one-time implementation fee
- **Enterprise:** ~$600-800/mo per provider with tiered volume discounts
- 12-month commitment, billed monthly

**Funding & Scale:**
- Backed by Microsoft (acquired Nuance for $19.7B in 2022)
- Largest installed base among enterprise solutions

**Notable Features:**
- Native Epic integration (embedded directly into Epic workflows)
- Supports 40+ major EHR systems at no additional cost
- Multi-party ambient conversation capture
- Specialty-specific clinical documentation summaries
- Human-assisted accuracy (combines AI + human review)

**Target Market:** Large health systems (100+ providers) on Epic with strong IT resources
- Ohio State University Wexner Medical Center: ~1,000 physicians and APPs
- Northwestern Medicine: 112% ROI, 3.4% service-level increase
- Multiple health systems with 66% reduction in documentation time (3-5 min savings per note)

**Market Position:** Most expensive option but unmatched EHR integration depth. Best for Epic-based health systems prioritizing documentation efficiency over cost.

---

### Suki AI

**Overview:** Multi-segment AI medical scribe targeting all market segments, EHR types, and specialties.

**Pricing:**
- **Suki Compose:** $299/mo
- **Suki Assistant:** $399/mo
- **Enterprise:** Custom pricing

**Funding & Scale:**
- **Total Raised:** $165M
- **Recent Funding:** $70M Series D led by Hedosophia, with Venrock, Flare Capital, March Capital, inHealth Ventures, Breyer Capital

**Notable Features:**
- Voice-enabled AI tool that generates notes, takes dictation, recommends codes, answers clinician questions
- Integrates with all major EHRs to pull and write data
- Works across desktop and mobile (iOS/Android)
- Supports 100+ specialties
- Works in all settings and form factors (urban/rural)

**Target Market:**
- Evolved from small practices to enterprise focus
- Primary target: Large hospital systems with hundreds of providers and established IT departments
- Also serves independent physicians and small practices

**Market Position:** "Only company focusing on all segments of the market" with universal EHR integration. Mid-market pricing between enterprise leaders and SMB tools.

---

## 2. SMB/Independent Practice Leaders

### Freed AI

**Overview:** AI-powered medical scribe for independent practices, most affordable mainstream option.

**Pricing:**
- **Standard:** $90-99/mo per clinician (individual)
- **Group Pricing:** $84/mo for 2-9 clinicians (billed annually)
- Student/trainee discounts available
- ~$1K ACV per clinician after discounts

**Funding & Scale:**
- **Total Raised:** $10.3M
- **Recent Funding:** $30M (exact round not specified), plus $7.5M Seed VC-II (March 2024) led by Sorin Investments, Multiply Ventures
- **Users:** 17,000-20,000 paying customers across 96 specialties

**Notable Features:**
- Specialty-aware AI documentation engine (96+ specialties)
- Structured AI with hundreds of targeted tasks to filter small talk, adjust terminology, match templates
- Notes learn from user edits
- Supports 14+ languages
- Purpose-built for any specialty visit

**Target Market:** Independent practices (47% of US clinicians)

**Market Position:** Most affordable mainstream option, significantly undercutting enterprise competitors. Strong product-market fit with independent practitioners.

---

### Heidi Health

**Overview:** Australian healthtech developing AI medical scribe for global market. Fastest international expansion.

**Pricing:**
- Pricing page exists but specific amounts not disclosed in search results
- Likely mid-range based on positioning

**Funding & Scale:**
- **Total Raised:** $96.6M
- **Valuation:** $465M (Series B)
- **Recent Funding:** $65M Series B led by Point72 Private Investments, with Headline, Blackbird, Latitude
- **Usage:** 2M+ patient interactions per week across 100+ countries
- **Time Saved:** 18M hours returned to clinicians in 18 months

**Notable Features:**
- Ambient microphone captures dialogue in 110+ languages
- Converts to SOAP-style notes in real-time
- Voice commands during consultation ("Heidi, add diabetes foot check to plan")
- LLM and ML-based structured documentation
- Generates referral letters, patient summaries, clinical documents

**Target Market:** Global market, especially strong in Australia, expanding to UK and Middle East

**Market Position:** Leading international competitor with strong momentum outside U.S. market. Highest language support (110+).

---

### Sunoh AI

**Overview:** AI medical scribe with usage-based pricing and wide provider adoption.

**Pricing:**
- **Per Visit:** $1.25/visit
- **Flat Rate:** $149/user/month (limited-time pricing)
- No hidden fees, no long-term commitments

**Funding & Scale:**
- **Users:** 90,000+ providers
- **Funding:** Not disclosed in search results

**Notable Features:**
- Flat-rate pricing model
- Partnership with eClinicalWorks (major EHR vendor)
- Used in women's specialty clinics and diverse practice types

**Target Market:** Broad provider base across specialties, especially those wanting predictable or usage-based pricing

**Market Position:** Strong adoption (90K+ providers) with flexible pricing. Positioned as affordable, accessible option for SMBs.

---

## 3. Behavioral Health Specialists

### Eleos Health (Enterprise Behavioral Health Leader)

**Overview:** Purpose-built AI platform for community behavioral health organizations.

**Pricing:**
- Not self-serve pricing (demo-led, quote-based)
- Enterprise sales motion
- Typical implementation: 2-3 months

**Funding & Scale:**
- **Total Raised:** $126M+ ($6M seed + $20M Series A + $40M Series B + $60M Series C)
- **Recent Funding:** $60M Series C (January 2025)

**Notable Features:**
- Generates 80% of progress note content automatically
- Reduces provider documentation time by 70%+
- Behavioral health-specific ML models and augmented intelligence
- Compliance automation: automatically scans progress notes for regulatory adherence
- Reduces audit-related penalties, denials, rejections
- Desktop and mobile support
- Delivers compliant progress note suggestions within minutes of session

**Target Market:** Community behavioral health organizations, CCBHCs (Certified Community Behavioral Health Clinics)

**Market Position:** Enterprise leader in behavioral health. Premium pricing with deep compliance features for organizations managing audit risk.

---

### Mentalyc

**Overview:** AI note taker for therapists with clinical insight focus.

**Pricing:**
- **Free Trial:** 14 days + 15 notes, no credit card
- **Starter:** $19.99/mo (40 clinical notes, annual billing)
- **Professional:** $39.99/mo (100 notes)
- **Premium:** $69.99/mo (unlimited notes)
- Save up to $300 with annual billing

**Funding & Scale:**
- Not disclosed in search results

**Notable Features:**
- 4 input methods: record live sessions, upload audio, dictation, or type summary
- Multiple note formats: SOAP, DAP, GIRP, BIRP, PIRP, SIRP, PIE, intake, custom templates
- HIPAA, PHIPA, SOC 2 compliant with BAA
- Anonymized transcriptions
- Works with any EHR, Zoom, desktop, tablet, mobile
- Data never used to train AI models

**Target Market:** Individual therapists, small therapy practices

**Market Position:** Mid-priced therapy solution with strong compliance and flexibility. Positioned as "notes as clinical insight" vs. pure documentation.

---

### Upheal

**Overview:** AI-powered mental health EHR platform with free AI note generation.

**Pricing:**
- **Free Plan:** £0/mo, unlimited notes
- **Starter:** £19/mo (~$23 USD)
- **Premium:** £59/mo (~$72 USD)

**Funding & Scale:**
- **Total Raised:** $14M (~$4.35M through seed)
- **Seed Round:** $3.25M led by Credo Ventures, with KAYA VC and Inovia Capital
- **Founded:** 2022

**Notable Features:**
- Unlimited AI notes completely free (unique in market)
- Captures key topics, symptoms, medications, treatment plans, goals automatically
- Multiple documentation styles: SOAP, GIRP, BIRP, DAP, EMDR, Mental Status Exam, Intake
- Analytics and conversation insights
- HIPAA, PHIPA, PHIPEDA, GDPR, SOC2 compliant

**Target Market:** Mental health professionals (therapists, psychiatrists, social workers), especially those wanting free core functionality

**Market Position:** Disruptive freemium model with unlimited free notes. Premium features monetize advanced functionality.

---

### Blueprint AI

**Overview:** Full EHR with built-in AI Assistant for independent therapists, or standalone Assistant for organizations.

**Pricing:**
- **Core (EHR):** Free, unlimited clients/sessions
- **Standard:** $0.49/session (automated documentation + telehealth)
- **Plus:** $0.99/session (clinical support, prep guidance, decision prompts)
- **Pro:** $1.49/session (AI-assisted EHR: intake, scheduling, billing, payments)
- No monthly commitment, credits never expire

**Funding & Scale:**
- Not disclosed in search results

**Notable Features:**
- Usage-based pricing (only pay when AI Assistant does work)
- Free full-featured EHR (not a trial)
- Automates progress notes, drafts treatment plans, surfaces insights
- Works before, during, and after sessions
- For organizations: AI Assistant plugs into existing EHR

**Target Market:** Independent therapists, especially part-time or variable caseloads. Organizations wanting to add AI to existing EHR.

**Market Position:** Unique freemium EHR + usage-based AI model. Flexible for variable workloads. Good fit for part-time clinicians.

---

### AutoNotes AI

**Overview:** AI progress notes for therapists with emphasis on speed and affordability.

**Pricing:**
- **Basic:** $19/mo (most budget-friendly)
- **Professional:** $49/mo (unlimited notes)
- 7-day free trial, no credit card required

**Funding & Scale:**
- Not disclosed in search results

**Notable Features:**
- Notes ready in 10 seconds
- Multiple formats: SOAP, DAP, BIRP, GIRP, PIE, progress notes, treatment plans, intake, discharge, specialty formats (group therapy, couples, family, EMDR)
- 3 input methods: dictate/record, write naturally, live "AutoScribe" during sessions
- Integrates with Zoom, Google Meet (browser-based, no downloads)
- System learns user's writing style and therapeutic modalities
- HIPAA-compliant, encrypted in transit and at rest
- 24/7 customer support

**Target Market:** Budget-conscious therapists wanting fast documentation

**Market Position:** Most affordable option ($19/mo entry) with emphasis on speed. Good for high-volume practices needing quick turnaround.

---

### JotPsych

**Overview:** Behavioral health AI scribe for psychiatrists, psychologists, therapists, PMHNPs.

**Pricing:**
- **Individual:** $150/mo
- **Group (7-50 providers):** $130/user/mo
- **Enterprise (50+ providers):** Custom pricing

**Funding & Scale:**
- Not disclosed in search results
- Average time savings: 30 hours/month per provider

**Notable Features:**
- 60+ behavioral health-specific note sections out of the box
- Captures psycho-social-behavioral factors
- Sensitive to behavioral health medications and terminology
- Identifies ICD-10, DSM-5-TR, and CPT codes automatically
- Customizable templates for sub-specialties
- Session transcripts for review and editing
- HIPAA-compliant
- Standalone or EHR-integrated

**Target Market:** Behavioral health providers, especially psychiatrists and PMHNPs who need coding support

**Market Position:** Mid-priced behavioral health specialist with strong coding assistance. DSM-5-TR and ICD-10 integration differentiates from therapy-focused competitors.

---

### Berries AI

**Overview:** AI scribe for mental health professionals with generous free tier.

**Pricing:**
- **Free:** $0, first 20 sessions + 10 new sessions every month ongoing, no credit card
- **Pro:** $99/mo (unlimited sessions, patient instructions, up to 180 min per session, dedicated support)
- **Annual Pro:** $79/mo if paid annually
- Group practice and student discounts available

**Funding & Scale:**
- **Users:** 10,000+ clinicians

**Notable Features:**
- Real-time session transcription with speech recognition and NLP
- Automated SOAP note generation
- Intelligent treatment plan suggestions
- Seamless EHR integration
- HIPAA-compliant, encrypted in transit and at rest
- BAAs with all customers and vendors handling PHI
- Session recordings automatically deleted after notes completed

**Target Market:** Mental health professionals wanting generous free tier before committing

**Market Position:** Strong freemium offering (20 initial sessions + 10/mo ongoing free). Pro plan at $99/mo is mid-range for mental health tools.

---

### Quill Therapy Notes

**Overview:** AI therapy notes generated from written summaries (no session recording).

**Pricing:**
- **Individual:** $20/mo (unlimited notes)
- **Team Members:** $16/mo per person

**Funding & Scale:**
- Not disclosed in search results

**Notable Features:**
- No session recording (privacy-first approach)
- Generates notes from brief written summaries
- Multiple note formats and custom templates
- Treatment plans with goals, objectives, interventions
- Can configure own documentation templates for intake, progress notes, treatment plans
- Custom instructions for note style
- HIPAA-compliant with BAA
- Data not kept, studied, or shared

**Target Market:** Therapists prioritizing privacy who prefer not to record sessions

**Market Position:** Unique positioning as non-recording solution. Lowest price for unlimited notes ($20/mo). Good for privacy-conscious therapists.

---

### TheraPro AI

**Overview:** HIPAA-certified AI scribe converting therapy sessions into progress notes.

**Pricing:**
- **Free:** 6 notes/week (Base AI model)
- **Basic:** 45 notes/week (Premium AI model)
- **Plus:** 90 notes/week (Premium AI model)
- **Unlimited:** For larger practices (Premium AI model)
- Pricing tiers not disclosed in search results

**Funding & Scale:**
- Not disclosed in search results

**Notable Features:**
- Produces DAP, SOAP, BIRP notes, plus unstructured paragraph summaries
- 2 AI models: Base (free tier) and Premium (paid tiers)
- Interprets 50+ languages (outputs English only)
- User-friendly interface
- HIPAA Compliant and 3rd-party certified
- Unlimited session lengths
- Comprehensive session histories
- Easy copy-paste into any EHR or practice management system

**Target Market:** Multilingual therapy practices, therapists wanting free tier to test before upgrading

**Market Position:** Broad language support (50+ input languages) and tiered free offering. Good for diverse client populations.

---

### Twofold Health (Closest Direct Competitor)

**Overview:** AI-powered medical scribe targeting multiple specialties including PT. Israeli-founded, NYC-based. One of the few competitors that explicitly lists Physical Therapy as a supported specialty.

**Pricing:**
- **Free Plan:** $0, all note types, custom templates
- **Personal:** $69/mo ($49/mo annual). Intro offer at $19/mo first month
- **Group:** Custom pricing with volume discounts, organization-wide BAA
- Promo code TWOFOLD30 for $30 off annual plans
- Referral program: 2 referrals = 1 year free premium

**Funding & Scale:**
- **Founded:** 2024
- **Team size:** 11-50 employees
- **Funding:** Early-stage; at least one investor (XT Venture Capital)
- **HQ:** New York, USA (Israeli-founded)

**Notable Features:**
- Unlimited notes on paid plan
- Custom templates and treatment plans
- Patient progress tracking
- Mobile + desktop apps
- Up to 1.5hr session recording
- HIPAA/BAA compliant (Microsoft Azure infrastructure)
- Personal writing style learning

**Supported Specialties:**
- Behavioral Health
- Internal Medicine
- Pediatrics
- **Physical Therapy**
- Primary Care
- Psychiatry

**Target Market:** Multi-specialty, primarily behavioral health based on content marketing focus. PT support appears template-level rather than deep workflow integration.

**Market Position:** Early-stage generalist that happens to support PT. Aggressive content marketing strategy (30+ comparison/review articles targeting competitor keywords). Priced competitively at $49-69/mo. Their comparison page is almost entirely focused on behavioral health competitors, suggesting that's where their actual user base is concentrated.

**Why They Matter to FlashNote:** Twofold is the closest direct competitor — similar stage, similar pricing band, and one of the few tools explicitly listing PT support. However, their PT offering appears to be breadth (multi-specialty templates) rather than depth (PT-specific workflows, billing codes, outcome measures). FlashNote's PT-specialist positioning is a meaningful differentiator.

---

## 4. Physical Therapy & Other Specialties

### Physical Therapy Market Overview

**Market Characteristics:**
- More competitive than initially assumed — at least 10+ players with PT support
- Manual documentation takes up to 2 hours for every 1 hour of patient care
- 86.3% of providers report administrative burnout
- AI adoption showing 25% reduction in documentation errors, 50% cut in documentation time
- Clinics report 20+ hours saved weekly, $30K+ annual revenue recovered
- ROI example: $180K annual revenue increase + $45K cost savings = 2,400% ROI
- Most PT solutions are ambient recording-based; FlashNote's shorthand-input model is a differentiator

**Key Features in PT Segment:**
- Voice dictation / ambient recording optimized for PT terminology
- Automatic EMR integration (WebPT, Prompt, Clinicient, Raintree are table-stakes)
- Billing and coding support (CPT code suggestions, Medicare 8-minute rule)
- Natural Language Processing for real-time SOAP note generation

### PT-Specific Competitors

#### ScribePT
- **Pricing:** $75/mo (annual contract) — lowest-priced PT-dedicated tool
- **Key Features:** PT-only. One-click EMR paste, personalized notes, speaker recognition, "All-Star AI Training," claims 20+ hrs/mo saved
- **EMR Integration:** EHR agnostic with paste-to-EMR
- **CPT Coding:** Yes
- **Threat Level:** Direct competitor on price and PT focus

#### Athelas Scribe
- **Pricing:** $75-150/mo
- **Funding:** **$6B valuation** — by far the most well-funded player touching PT
- **Key Features:** Ambient scribe with PT support, CPT coding suggestions, automatic EMR transfer, multi-language, mobile
- **Target:** Multi-specialty but with meaningful PT presence
- **Threat Level:** High — massive funding could fuel rapid PT feature development

#### Comprehend (ComprehendPT)
- **Pricing:** $91-99/mo
- **Key Features:** PT-specific note personalization, section customization
- **EMR Integration:** WebPT, Prompt, Empower, PTeverywhere, Jane, Athena — deepest PT EMR integration story
- **Threat Level:** High on EMR integration depth; this is the feature FlashNote would need to match

#### Prediction Health
- **Pricing:** $105/mo
- **Key Features:** AI-powered PT documentation
- **EMR Integration:** Athenahealth, Clinicient, Empower, Prompt, WebPT, Raintree
- **Threat Level:** Moderate — strong EMR story but higher price

#### HippoScribe
- **Pricing:** $99/mo
- **Key Features:** EHR agnostic ambient scribe for rehab professionals
- **Target:** PT, OT, SLP
- **Threat Level:** Moderate — rehab-focused generalist

#### Tapt Health
- **Pricing:** ~$99/mo + add-on fees for EMR transfer (uses human scribes for QA)
- **Key Features:** Hybrid AI + human scribe model, delayed documentation processing
- **Threat Level:** Low — hybrid model adds cost and latency

#### Other PT-Adjacent Players
- **SPRY (Sprypt)** — PT practice management with AI documentation
- **ezPT** — Free PT AI documentation software
- **OneChart.ai** — Rehab-focused ambient scribing with billing intelligence
- **S10.AI** — AI scribe with PT support
- **PatientNotes** — General AI note tool with PT templates
- **SOAP Note AI** — General SOAP note generator

**Market Assessment (Revised):**
- PT AI documentation is **more competitive than originally assessed** — at least 6 dedicated PT tools plus several generalists with PT support
- However, most competitors use **ambient recording** as input. FlashNote's **shorthand text input** model remains differentiated
- EMR integration depth (especially WebPT, Prompt, Raintree) is table-stakes — multiple competitors already have it
- CPT coding and billing support is becoming expected, not differentiating
- **Browser extension portability** across any EMR is a genuine differentiator vs. tools locked to specific integrations

---

## 5. Additional General/Enterprise Competitors

### Ambience Healthcare

**Overview:** Enterprise ambient AI documentation platform backed by major VC firms.

**Funding & Scale:**
- **Total Raised:** $243M Series C (July 2025)
- **Investors:** Oak HC/FT, Andreessen Horowitz, OpenAI Startup Fund, Kleiner Perkins, Optum Ventures

**Market Position:** Enterprise-tier competitor to Abridge and DAX. Targets large health systems. Not a direct FlashNote competitor but indicative of capital flooding the space.

---

### Nabla

**Overview:** Ambient AI medical assistant generating structured notes within seconds. Emphasizes efficiency and data security.

**Target Market:** Mid-market, general medicine.

**Market Position:** European-origin, expanding to U.S. Not PT-focused.

---

### DeepScribe

**Overview:** Multi-specialty ambient AI scribe with major EHR integrations.

**Target Market:** Mid-market across diverse specialties.

**Market Position:** Established player, less visibility than Freed/Heidi but solid product.

---

### Tali

**Overview:** Hybrid AI scribe + medical Q&A tool. Providers can query the app for diagnostic criteria, treatment options, or clinical guidelines during documentation.

**Target Market:** Mid-market, general medicine.

**Market Position:** Differentiated by built-in clinical decision support, not just documentation.

---

### OrbDoc

**Overview:** AI scribe with evidence-linking — every statement in notes links to the exact conversation moment where that information was discussed. 7-year audio retention for audit defense.

**Target Market:** Providers in audit-heavy environments.

**Market Position:** Unique evidence-linking feature could be compelling for PT (Medicare audits).

---

### athenaAmbient

**Overview:** Free ambient AI scribe bundled with athenahealth EHR (launched February 2026).

**Pricing:** **Free** for athenahealth customers.

**Market Position:** Existential threat to all SMB-priced scribes. Commoditizes basic ambient documentation for the hundreds of thousands of providers on athenahealth. Forces standalone tools to differentiate on specialty depth or features athenaAmbient doesn't cover.

---

### Lyrebird Health (Australia)

**Overview:** Australian AI medical scribe expanding globally (UK, Middle East).

**Pricing:**
- **Lite:** Free (50 actions/month)
- **Pro:** $89/mo USD ($828/year annual billing = $69/mo)
- **Australia Pricing:** Starting from AUD $150/user/month depending on usage
- 80% discount for registrars during employment

**Funding & Scale:**
- **Recent Funding:** $12M led by Five V Capital and Octopus Ventures (UK), with Startmate
- **Usage:** 30,000 consultations daily in Australia (growing 10%+ monthly)
- **May 2025:** 600,000 consultations
- **Founded:** Early 2023 by Kai Van Lieshout and Linus Talacko

**Notable Features:**
- Records patient-doctor conversations, generates clinical documentation
- Saves 6-8 minutes per consultation
- Native integration with Best Practice and Gentu (Australian EMRs)
- Expanding to UK and Middle East with funding
- Australian data sovereignty and regulatory compliance

**Target Market:** Australian providers, expanding to UK and Middle East

**Market Position:** Leading Australian competitor with strong local EMR integration. International expansion underway.

---

## Market Dynamics & Trends

### Adoption Trends

**Current Adoption Rates:**
- ~1 in 5 providers at full rollout
- 2 in 5 providers in pilot phase
- When widely available, adoption rates: 20-50%
- One organization achieved 75-80% adoption through emphasis on note customization
- ~33% of providers have access to ambient AI scribe technology

**Enterprise Deployment Patterns:**
- Shift from "departmental pilots" to "wall-to-wall deployment"
- First major health system deployed to all 15,000 clinicians (including nurses, PTs)
- VA nationwide rollout validates technology at largest healthcare system level
- athenahealth including athenaAmbient free with EHR (Feb 2026) removes cost barriers for hundreds of thousands of providers

**Technology Validation:**
- AI medical scribes reached enterprise scale in 2026
- Physicians saving 2-3 hours daily on documentation
- 15% more patients seen per hour
- 66% reduction in documentation time (3-5 min saved per note at major health systems)

---

### Specialty Accuracy Trends

**Highest Accuracy:**
- Primary care
- Internal medicine
- Psychiatry
- **Reason:** Abundant training data

**Lower Accuracy:**
- Highly specialized fields (neurosurgery, interventional radiology)
- **Reason:** Unique terminology, less training data

**Specialty vs. General Trade-off:**
- General scribes capture words but miss "clinical heartbeat" and nuance
- Specialty-specific solutions command premium pricing
- Specialty documentation segment growing at fastest CAGR due to unique workflows, terminology, regulatory requirements

---

### Emerging Threats & Opportunities

**Existential Threats:**
1. **Epic Native AI Charting Tool (August 2025 launch)**
   - Epic powers largest health systems
   - Native integration eliminates need for 3rd-party scribes
   - Potential to commoditize or eliminate standalone scribe vendors for Epic customers

2. **athenahealth Free Ambient AI (February 2026)**
   - Removes cost barrier for hundreds of thousands of providers
   - Commoditizes basic ambient documentation
   - Forces differentiation on advanced features, specialty depth, or value-added services

3. **Consolidation Risk**
   - 2 players control two-thirds of $600M market
   - Smaller players may struggle for funding or get acquired
   - Venture funding may dry up for undifferentiated competitors

**Opportunities:**
1. **Specialty Depth**
   - General documentation crowded, specialty-specific underserved
   - Mental health crowded, but PT, cardiology, oncology, etc. still open
   - Premium pricing for specialty-specific accuracy and workflows

2. **International Expansion**
   - Most competitors U.S.-focused
   - Heidi, Lyrebird showing success in Australia, UK, Middle East
   - Regulatory complexity creates moat for early entrants

3. **Compliance & Audit Automation**
   - Eleos Health model: Documentation + compliance scanning
   - High-value for community behavioral health, any audit-heavy specialty
   - Reduces denial rates, audit penalties (revenue protection, not just time savings)

4. **Usage-Based & Freemium Models**
   - Blueprint ($0.49-1.49/session), Sunoh ($1.25/visit) vs. flat monthly
   - Attracts part-time, variable caseload clinicians
   - Upheal (unlimited free notes) and Berries (20 free sessions + 10/mo) drive trial and adoption

5. **Non-Recording Solutions**
   - Quill Therapy Notes: no session recording, generates from written summaries
   - Privacy-first positioning for therapists uncomfortable with recording
   - Addresses regulatory concerns in states with strict recording laws

---

### Pricing Strategy Insights

**Enterprise Tier ($300-600/mo):**
- Customers: Large health systems, hospitals
- Value Proposition: Deep EHR integration, governance, compliance, enterprise support
- Examples: DAX Copilot ($369-600/mo), Abridge (~$208-500/mo), Suki ($299-399/mo)

**Mid-Market Tier ($100-299/mo):**
- Customers: Small-to-medium practices (5-50 providers), specialty clinics
- Value Proposition: Strong features without enterprise overhead
- Examples: Freed ($90-99/mo), Sunoh ($149/mo), JotPsych ($150/mo), Lyrebird ($89/mo)

**SMB/Individual Tier ($19-99/mo):**
- Customers: Individual practitioners, part-time clinicians, small therapy practices
- Value Proposition: Affordable, easy to start, no long-term commitment
- Examples: Mentalyc ($20-70/mo), AutoNotes ($19-49/mo), Quill ($20/mo), Upheal ($19-59/mo), Berries ($79-99/mo)

**Usage-Based Models:**
- Blueprint ($0.49-1.49/session)
- Sunoh ($1.25/visit)
- **Advantage:** Attractive to variable caseloads, part-time providers
- **Challenge:** Revenue less predictable for vendor

**Freemium Models:**
- Upheal (unlimited free notes)
- Berries (20 free sessions + 10/mo ongoing)
- TheraPro (6 notes/week free)
- Blueprint (free EHR, pay only for AI usage)
- **Advantage:** Low barrier to trial, viral growth
- **Challenge:** Monetization of free users, support costs

---

### Go-to-Market Strategy Patterns

**Enterprise Sales (Abridge, DAX, Eleos):**
- Demo-led, quote-based pricing
- 2-3 month implementation cycles
- Emphasis on security, governance, EHR integration depth
- Multi-year contracts with volume discounts
- High CAC, high LTV, long sales cycles

**Product-Led Growth (Freed, Mentalyc, Upheal, AutoNotes):**
- Self-serve signup, free trials or freemium tiers
- Fast onboarding (minutes to hours, not months)
- Emphasis on ease of use, immediate time savings
- Monthly subscriptions, easy to cancel
- Low CAC, moderate LTV, viral growth potential

**Hybrid (Suki, Heidi, Sunoh):**
- Self-serve for individuals/small practices
- Enterprise sales for large organizations
- Flexible pricing (monthly or usage-based)
- Scalable from 1 provider to 1,000+

---

## Competitive Gaps & White Space

### Underserved Specialties
1. **Physical Therapy:** More competitive than initially assumed (6+ dedicated tools), but most use ambient recording. Shorthand/text-input approach remains underserved. Strong ROI case (2,400%). Integration with PT-specific EMRs is table-stakes.
2. **Occupational Therapy:** Similar to PT but even less competitive attention
3. **Speech-Language Pathology:** Unique documentation requirements, minimal AI solutions
4. **Chiropractic:** Independent practices, unique terminology, underserved
5. **Specialty Medicine (Non-Primary Care):** Cardiology, oncology, dermatology have unique workflows but rely on general-purpose scribes

### Underserved Customer Segments
1. **Locum Tenens Providers:** Transient, need portable solution that works across facilities/EHRs
2. **Multi-Specialty Groups:** Need one solution across multiple specialties (most tools are general or specialty-specific, not multi-specialty)
3. **Rural Providers:** Often underserved by enterprise solutions requiring on-site IT support
4. **International Markets (Non-English):** Most solutions U.S.-focused. Heidi (110 languages) and TheraPro (50 languages) show demand exists

### Underserved Features
1. **Compliance Automation:** Only Eleos offers automated compliance scanning. High value for audit-heavy specialties.
2. **Coding & Billing Integration:** JotPsych offers CPT code identification. Most competitors focus only on documentation.
3. **Treatment Plan Generation:** Blueprint, Mentalyc, Berries offer treatment plans. Most competitors focus only on progress notes.
4. **Patient-Facing Summaries:** Few solutions generate patient-friendly summaries or after-visit instructions
5. **Multi-Provider Sessions:** Group therapy, couples therapy, family therapy poorly served by single-provider scribes

---

## Strategic Implications for FlashNote

### Positioning Recommendations

**Target Market:** Physical Therapy (PT-specific focus)
- **Why:** Strong demand (86.3% admin burnout), proven ROI (2,400% case study), and no dominant market leader despite 10+ players
- **Competition:** ScribePT, Athelas ($6B), Comprehend, Prediction Health, HippoScribe, Twofold, SPRY, ezPT, OneChart, S10.AI — crowded but fragmented
- **Differentiator:** Nearly all competitors use ambient recording. FlashNote's shorthand text input + browser extension portability is a genuinely different approach
- **Risk:** PT EMR integration (WebPT, Prompt, Raintree) is table-stakes — Comprehend and Prediction Health already have deep integrations

**Pricing Strategy:**
- **SMB/Independent Practice Tier:** $49-99/mo to position between Freed ($90/mo) and mid-market ($150+/mo)
- **Rationale:** PTs are small practices (1-10 providers typically), price-sensitive like therapists but higher revenue per patient than therapy (PT avg $100-150/visit vs. therapy $100-200/visit)
- **Alternative:** Usage-based ($1-2/session) to compete with Blueprint's model for part-time PTs

**Differentiation:**
1. **PT-Specific Features:**
   - PT-specific SOAP note templates (subjective, objective with measurements, assessment with progress, plan with HEP)
   - Home Exercise Program (HEP) integration
   - Outcome measures tracking (LEFS, DASH, Oswestry, etc.)
   - Functional goals documentation

2. **Billing & Coding:**
   - CPT code recommendations for PT services
   - Automatic duration tracking for timed codes
   - Documentation compliance for payer requirements (Medicare 8-minute rule)

3. **PT EMR Integration:**
   - Integrate with WebPT, Clinicient, TheraOffice, Net Health (top PT EMRs)
   - Lighter lift than Epic/Cerner but high value for target market

4. **Quickstart Workflow:**
   - Browser extension for portability across EMRs
   - Voice input optimized for PT terminology (ROM, strength testing, special tests, manual therapy techniques)
   - Works in-person or telehealth

**Go-to-Market:**
- **Product-Led Growth:** Self-serve signup, free trial (10-20 notes), fast onboarding
- **Community Building:** PT-specific Facebook groups, APTA conferences, PT podcast sponsorships
- **Referral Program:** PTs are networked within local communities (clinic owners, colleagues)
- **Content Marketing:** PT-specific documentation guides, SOAP note templates, billing compliance tips

---

### Competitive Threats to Monitor

1. **Athelas ($6B valuation):** Massively funded, already in PT space. Could dominate with feature investment
2. **athenaAmbient (free):** Commoditizes basic ambient scribing for athenahealth users — forces differentiation
3. **Comprehend/Prediction Health EMR depth:** Already integrated with WebPT, Prompt, Raintree — hard to catch up
4. **Abridge/DAX Expanding to SMB:** Enterprise players could move downmarket with simplified offerings
5. **Epic Native AI for PT:** If Epic adds PT-specific AI to its EHR, enterprise PT clinics may not need standalone tools
6. **General-Purpose Tools Adding PT Templates:** Freed, Heidi, or Suki could add PT-specific features to capture market
7. **Freemium Competitors:** Upheal-style unlimited free model could undercut paid PT solutions
8. **Market consolidation:** 100+ funded AI scribe companies exist; most won't survive (Commure acquired Augmedix for $139M in Oct 2024)

---

### Success Metrics to Track

**Competitive Intelligence:**
- Monthly monitoring of competitor pricing changes
- Feature releases from PT-specific competitors (ScribePT, Athelas, Comprehend, Prediction Health) and top general players (Freed, Heidi, Abridge, DAX, Suki)
- Funding announcements (market validation or competitive threat)
- Customer reviews on G2, Capterra, TrustPilot for top competitors

**Market Adoption:**
- PT-specific AI scribe adoption rates (currently lower than mental health, represents opportunity)
- PT EMR vendor partnerships (WebPT, Clinicient integrations by competitors)
- PT conference buzz (APTA, state PT associations)

**Internal Metrics:**
- Time saved per note (target: 5-10 min per PT SOAP note)
- Documentation accuracy (minimize required edits)
- Billing compliance (notes meet payer requirements for reimbursement)
- User retention (monthly active users, churn rate)
- NPS score (word-of-mouth critical in PT community)

---

## Conclusion

The AI medical scribe market is at an inflection point:
- **Enterprise segment consolidating** around Abridge, DAX Copilot, and Ambience Healthcare
- **SMB/independent practice segment fragmenting** with 15+ competitors
- **Mental health most saturated** specialty (10+ dedicated tools)
- **Physical therapy more competitive than initially assumed** — 6+ dedicated PT tools plus generalists with PT support, but no dominant leader and most use ambient recording
- **EHR vendors bundling free AI** (athenaAmbient, Epic) threatens all standalone scribes
- **100+ funded AI scribe companies** — most won't survive; consolidation is inevitable

**FlashNote's Opportunity:**
- Shorthand text input (not ambient recording) is a genuinely different approach in a space where nearly everyone records
- Browser extension portability works across any EMR without needing per-EMR integrations
- SMB pricing ($49-99/mo) in sweet spot between enterprise and budget tools
- Strong ROI case for PT practices (time savings + billing compliance)

**FlashNote's Risks:**
- PT space is more crowded than originally assessed — Athelas alone has $6B in backing
- EMR integration depth (WebPT, Prompt, Raintree) is becoming table-stakes; competitors already have it
- Free ambient AI from EHR vendors could make "good enough" scribing a default feature
- Market consolidation could squeeze underfunded entrants

**Key Success Factors:**
1. Lean into the shorthand-input differentiator — speed and workflow fit for PTs who don't want to record
2. Billing/coding support for PT reimbursement (CPT codes, 8-minute rule)
3. Fast, frictionless onboarding (minutes, not months)
4. Community-driven growth (PT networks, referrals)
5. Product-led growth with free trial to drive adoption
6. Avoid competing on EMR integration depth until product-market fit is proven

---

## Sources

### Market Overview & Leaders
- [The Best AI Medical Scribe for Happier Clinicians | Freed](https://www.getfreed.ai)
- [Freed revenue, funding & growth rate | Sacra](https://sacra.com/c/freed/)
- [Freed says 20,000 clinicians are using its medical AI transcription 'scribe,' but competition is rising fast | VentureBeat](https://venturebeat.com/ai/freed-says-20000-clinicians-are-using-its-medical-ai-transcription-scribe-but-competition-is-rising-fast)
- [Heidi Health - Wikipedia](https://en.wikipedia.org/wiki/Heidi_Health)
- [Heidi raises $65M to expand global reach of its AI medical scribe platform | MobiHealthNews](https://www.mobihealthnews.com/news/heidi-health-raises-65m-expand-global-reach-its-ai-medical-scribe-platform)
- [DAX Copilot Pricing | Simple, Transparent Medical Scribe Pricing](https://trydax.com/pricing/)
- [Microsoft Dragon Copilot | Microsoft for Healthcare](https://www.microsoft.com/en-us/health-solutions/clinical-workflow/dragon-copilot)
- [Suki secures $70M to enhance its AI ambient scribe offerings | MobiHealthNews](https://www.mobihealthnews.com/news/suki-secures-70m-enhance-its-ai-ambient-scribe-offerings)
- [Sunoh AI Review 2026: Features and Limitations](https://www.trytwofold.com/compare/sunoh-ai-review)

### Behavioral Health Competitors
- [Eleos secures $60M for behavioral health with AI agents | MobiHealthNews](https://www.mobihealthnews.com/news/eleos-secures-60m-behavioral-health-ai-agents)
- [Eleos raises $60 million for AI scribe for behavioral health providers | STAT](https://www.statnews.com/2025/01/22/eleos-behavioral-health-tech-clinical-documentation-startup-fundraise/)
- [Pricing and Plans - Mentalyc](https://www.mentalyc.com/pricing)
- [Best AI Progress Note Taker & AI Scribe for Therapists | Mentalyc](https://www.mentalyc.com/)
- [Upheal Raises $3.25M to Revolutionize Mental Health with AI Therapy Notes Transcription](https://therecursive.com/upheal-raises-3-25-m-revolutionize-mental-health-with-ai-therapy-notes-transcription/)
- [Mental Health EHR with Free AI Tools | Upheal](https://www.upheal.io/)
- [Blueprint: EHR + AI Assistant for Therapists](https://www.blueprint.ai/)
- [Pricing | Blueprint](https://www.blueprint.ai/pricing)
- [AutoNotes Pricing | Simple Plans for Therapists & Clinics](https://www.autonotes.ai/pricing)
- [JotPsych | Behavioral Health AI Scribe Software](https://www.jotpsych.com)
- [Berries | AI Scribe for Mental Health Professionals](https://heyberries.com/)
- [Quill: AI-generated notes for therapists without recording therapy sessions](https://quilltherapysolutions.com/)
- [TheraPro AI Reviews 2026: Pricing, Features & More](https://www.selecthub.com/p/therapy-note-software/therapro-ai/)

### Market Analysis & Trends
- [U.S. AI In Medical Scribing Market | Industry Report, 2033](https://www.grandviewresearch.com/industry-analysis/us-ai-medical-scribing-market-report)
- [Emerging Growth Patterns Driving the Expansion of the Artificial Intelligence (AI) Medical Scribe Software Market](https://www.openpr.com/news/4392286/emerging-growth-patterns-driving-the-expansion-of)
- [AI in Healthcare Market Size, Share | Growth Report [2026-2034]](https://www.fortunebusinessinsights.com/industry-reports/artificial-intelligence-in-healthcare-market-100534)
- [AI In Mental Health Market Size, Share | Industry Report 2033](https://www.grandviewresearch.com/industry-analysis/ai-mental-health-market-report)
- [AI in Mental Health Market Growth Analysis | CAGR of 32.1%](https://market.us/report/ai-in-mental-health-market/)
- [Ambient AI scribes, by market share](https://www.beckershospitalreview.com/healthcare-information-technology/ai/ambient-ai-scribes-by-market-share/)
- [Do Ambient Scribe Startups Have a Future Now That Epic Launched Its Own Tool? | MedCity News](https://medcitynews.com/2026/02/ambient-scribe-ai-startups-epic/)

### Abridge (Market Leader)
- [Generative AI for Clinical Conversations | Abridge](https://www.abridge.com/)
- [Abridge raises $300 million as the market for AI scribes heats up | STAT](https://www.statnews.com/2025/06/24/ai-clinical-documentation-ambient-scribe-abridge-raises-300-million/)
- [In just 4 months, AI medical scribe Abridge doubles valuation to $5.3B | TechCrunch](https://techcrunch.com/2025/06/24/in-just-4-months-ai-medical-scribe-abridge-doubles-valuation-to-5-3b/)
- [Abridge valuation, funding & news | Sacra](https://sacra.com/c/abridge/)

### Physical Therapy & International
- [AI for Physical Therapy Notes & Documentation: Save Time & Improve Accuracy](https://www.sprypt.com/blog/ai-for-physical-therapy-notes-documentation)
- [Best AI Scribes for Physical Therapists in 2025 | OneChart.ai](https://onechart.ai/best-ai-scribe-for-physical-therapy-2025-onechart/)
- [Aussie AI scribe startup to go global with $12M funding | MobiHealthNews](https://www.mobihealthnews.com/news/anz/aussie-ai-scribe-startup-go-global-12m-funding)
- [Lyrebird Health Review 2025: My Deep Dive into the AI Scribe Changing Medicine](https://skywork.ai/skypage/en/Lyrebird-Health-Review-2025-My-Deep-Dive-into-the-AI-Scribe-Changing-Medicine/1974529962592497664)

### PT-Specific Competitors & Rehab Comparisons
- [ScribePT - A Comparison of Physical Therapy AI Documentation Tools](https://www.scribept.com/a-comparison-of-physical-therapy-ai-documentation-tools/)
- [OT Potential - Rehab AI Scribes Compared for OT, PT, and SLP](https://otpotential.com/blog/rehab-ai-scribes-compared-for-ot-pt-and-slp)
- [ScribePT - The Best AI Scribe for Rehab Therapists](https://www.scribept.com/)
- [Twofold Health - AI Medical Scribe for Physical Therapy](https://www.trytwofold.com/specialties/physical-therapy)
- [Twofold Health - Compare](https://www.trytwofold.com/compare)

### Additional Enterprise & General Competitors
- [Ambience Healthcare Announces $243M Series C](https://www.ambiencehealthcare.com/blog/ambience-healthcare-announces-243-million-series-c-to-scale-its-ai-platform-for-health-systems)
- [Ambience Healthcare scores $243M for ambient AI documentation | MobiHealthNews](https://www.mobihealthnews.com/news/ambience-healthcare-scores-243m-ambient-ai-documentation-platform)
- [Best AI Scribes for Clinicians 2026 | Freed](https://www.getfreed.ai/resources/best-ai-scribes)
- [Best AI Medical Scribes 2026 | SOAPNoteAI](https://www.soapnoteai.com/soap-note-guides-and-example/best-ai-medical-scribes-2026/)
- [The 10 Best AI Scribes 2026 | Skriber](https://skriber.com/blog/best-ai-scribes)

### Specialty Segmentation
- [Specialty-Specific AI: Why Your Cardiology Practice Needs More Than a General Scribe](https://www.transdyne.com/cardiology-specialty-ai-scribe-vs-general/)
- [How AI Medical Scribes Are Trained for Specialty Practices](https://www.getscribeai.co/post/how-ai-medical-scribes-are-trained-for-specialty-practices)
