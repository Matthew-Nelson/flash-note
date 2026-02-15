# HIPAA Security Requirements for FlashNote (2026)

**Created:** February 15, 2026
**Status:** 🔴 Research Document - Not Yet Implemented
**Priority:** P0 - Production Blockers Identified

---

## Executive Summary

This document provides comprehensive research on current and upcoming HIPAA Security Rule requirements for FlashNote, a healthcare SaaS product that processes ePHI (electronic Protected Health Information) via a browser extension and web application.

**Key Findings:**

1. **2025 NPRM (Notice of Proposed Rulemaking)** published January 6, 2025, proposes the most significant HIPAA Security Rule changes since 2003
2. **Final rule expected May 2026** with 180-day compliance period
3. **"Addressable" safeguards eliminated** - nearly all specifications become mandatory
4. **MFA, encryption, vulnerability scanning now required** for all entities
5. **Political uncertainty** - Trump Executive Order on regulatory freeze may delay implementation

**Production Blockers for FlashNote:**
- ✅ TLS 1.2+ encryption in transit (already implemented)
- ⚠️ Encryption at rest (database) - not yet deployed
- ❌ Multi-factor authentication - not implemented
- ❌ Automatic session timeout - not implemented
- ❌ Vulnerability scanning (6-month intervals) - not configured
- ❌ Penetration testing (annual) - not scheduled
- ❌ 72-hour system recovery capability - not documented
- ❌ Audit log retention automation (6 years) - not implemented
- ❌ Annual compliance audit process - not documented
- ❌ Google Cloud Vertex AI BAA - not signed

---

## Table of Contents

1. [Current HIPAA Security Rule Requirements (45 CFR 164.312)](#1-current-hipaa-security-rule-requirements)
2. [2025 NPRM: Upcoming Changes](#2-2025-nprm-upcoming-changes)
3. [Business Associate Agreement (BAA) Requirements](#3-business-associate-agreement-requirements)
4. [FlashNote-Specific Requirements](#4-flashnote-specific-requirements)
5. [Developer Resources](#5-developer-resources)
6. [Implementation Roadmap](#6-implementation-roadmap)

---

## 1. Current HIPAA Security Rule Requirements

The HIPAA Security Rule establishes national standards to protect ePHI that is created, received, maintained, or transmitted electronically. The rule is divided into Administrative (§164.308), Physical (§164.310), and Technical (§164.312) safeguards.

### 1.1 Access Controls (§164.312(a)(1)) - REQUIRED

**Standard:** Implement technical policies and procedures for electronic information systems that maintain ePHI to allow access only to those persons or software programs that have been granted access rights.

**Implementation Specifications:**

1. **Unique User Identification (§164.312(a)(2)(i)) - REQUIRED**
   - Assign a unique name and/or number for identifying and tracking user identity
   - **FlashNote Status:** ✅ Implemented (user IDs, email-based identity)

2. **Emergency Access Procedure (§164.312(a)(2)(ii)) - REQUIRED**
   - Establish procedures for obtaining necessary ePHI during an emergency
   - **FlashNote Status:** ❌ Not documented (no emergency access procedures)

3. **Automatic Logoff (§164.312(a)(2)(iii)) - ADDRESSABLE**
   - Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity
   - **Current Status:** Addressable (not technically "required")
   - **NPRM Change:** Will become REQUIRED under proposed rule
   - **Recommended Timeout:** 5-10 minutes for shared areas; 15 minutes maximum for restricted areas; ≤2 minutes for systems containing ePHI per security experts
   - **FlashNote Status:** ⚠️ Partial (JWT access tokens expire in 1 hour, but no client-side automatic logoff on inactivity)

4. **Encryption and Decryption (§164.312(a)(2)(iv)) - ADDRESSABLE**
   - Implement a mechanism to encrypt and decrypt ePHI
   - **Current Status:** Addressable
   - **NPRM Change:** Will become REQUIRED for all ePHI at rest and in transit
   - **FlashNote Status:** ✅ In transit (TLS 1.2+), ⚠️ At rest (database encryption not yet deployed)

### 1.2 Audit Controls (§164.312(b)) - REQUIRED

**Standard:** Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use ePHI.

**What Must Be Logged:**
- User ID (unique identifier)
- Date and time (precise timestamps)
- Event type (logon, logoff, record access, modification, deletion)
- Patient or record identifiers (WITHOUT PHI content)
- Source IP address/device
- System involved
- Event outcome (success/failure)

**Retention Period:**
- **HIPAA Requirement:** 6 years minimum (45 CFR § 164.316(b)(2)(i))
- **State Laws:** May require longer (check applicable jurisdictions)

**Protection Requirements:**
- Tamper-proof storage (write-once, cryptographic hashing)
- Restricted admin access
- Regular backups
- Active review (logging alone is insufficient - must analyze for unauthorized access)

**FlashNote Status:**
- ✅ Audit logging implemented (`audit_logs` table)
- ⚠️ No automated retention enforcement
- ❌ No tamper-proof protections (WORM storage, hashing)
- ❌ No documented review procedures

### 1.3 Integrity Controls (§164.312(c)(1)) - REQUIRED

**Standard:** Implement policies and procedures to protect ePHI from improper alteration or destruction.

**Implementation Specification:**

**Mechanism to Authenticate ePHI (§164.312(c)(2)) - ADDRESSABLE**
- Implement electronic mechanisms to corroborate that ePHI has not been altered or destroyed in an unauthorized manner
- **Examples:** Checksums, digital signatures, message authentication codes
- **NPRM Change:** May become REQUIRED
- **FlashNote Status:** ❌ Not implemented (no ePHI integrity verification mechanisms)

### 1.4 Person or Entity Authentication (§164.312(d)) - REQUIRED

**Standard:** Implement procedures to verify that a person or entity seeking access to ePHI is the one claimed.

**FlashNote Status:** ✅ Implemented (bcrypt passwords, JWT tokens)

**NPRM Addition:** Multi-factor authentication will become REQUIRED

### 1.5 Transmission Security (§164.312(e)(1)) - REQUIRED

**Standard:** Implement technical security measures to guard against unauthorized access to ePHI that is being transmitted over an electronic communications network.

**Implementation Specifications:**

1. **Integrity Controls (§164.312(e)(2)(i)) - ADDRESSABLE**
   - Implement security measures to ensure electronically transmitted ePHI is not improperly modified without detection
   - **NIST Standard:** TLS 1.2+ or IPSec VPNs (NIST SP 800-52 r2, SP 800-77)
   - **FlashNote Status:** ✅ TLS 1.2+ enforced (backend configured with TLS)

2. **Encryption (§164.312(e)(2)(ii)) - ADDRESSABLE**
   - Implement a mechanism to encrypt ePHI whenever deemed appropriate
   - **Current Status:** Addressable ("whenever deemed appropriate")
   - **NPRM Change:** Will become REQUIRED for all ePHI in transit
   - **NIST Standard:** TLS 1.2 minimum, TLS 1.3 recommended; disable SSL, TLS 1.0/1.1, RC4, 3DES
   - **FlashNote Status:** ✅ Implemented (all API calls over HTTPS with TLS 1.2+)

### 1.6 Administrative Safeguards (§164.308)

While not the focus of this technical document, key administrative requirements include:

1. **Security Management Process (§164.308(a)(1)) - REQUIRED**
   - **Risk Analysis (REQUIRED):** Conduct accurate assessment of risks to ePHI confidentiality, integrity, availability
   - **Risk Management (REQUIRED):** Implement security measures to reduce risks to reasonable/appropriate level
   - **Sanction Policy (REQUIRED):** Apply sanctions against workforce members who violate security policies
   - **Information System Activity Review (REQUIRED):** Regularly review audit logs, access reports, incident tracking

2. **Security Incident Procedures (§164.308(a)(6)) - REQUIRED**
   - Identify and respond to suspected or known security incidents
   - Mitigate, to the extent practicable, harmful effects
   - Document security incidents and their outcomes
   - **NPRM Addition:** Written incident response plans with 72-hour recovery requirement

**FlashNote Status:**
- ❌ Formal risk analysis not documented
- ❌ Security incident response plan not documented
- ❌ Information system activity review procedures not documented

---

## 2. 2025 NPRM: Upcoming Changes

### 2.1 Overview

On **January 6, 2025**, the Department of Health and Human Services (HHS) Office for Civil Rights (OCR) published a Notice of Proposed Rulemaking (NPRM) in the Federal Register to modernize the HIPAA Security Rule. This represents the most significant update since the Security Rule's original 2003 implementation.

**Key Dates:**
- **Published:** January 6, 2025
- **Comment Period Ended:** March 7, 2025 (60 days; over 4,000 comments received)
- **Expected Final Rule:** May 2026
- **Compliance Period:** 180 days after final rule publication (likely November 2026)

**Political Uncertainty:**
Two weeks after publication, President Trump issued an Executive Order requiring a "Regulatory Freeze Pending Review." The fate of the NPRM is unclear, but OCR has indicated intent to finalize.

### 2.2 Elimination of "Addressable" vs "Required" Distinction

**Current Rule:**
- "Required" specifications must be implemented
- "Addressable" specifications must be implemented if reasonable and appropriate, OR document an equivalent alternative

**Problem:**
HHS observed that entities incorrectly interpreted "addressable" as "optional," resulting in compliance gaps and increased ePHI risks.

**Proposed Change:**
Eliminate the distinction entirely. All implementation specifications become REQUIRED with specific, limited exceptions based on documented risk analysis.

**Impact for FlashNote:**
Previously addressable specifications that will become mandatory:
- ✅ Encryption in transit (already implemented)
- ❌ Encryption at rest (not yet deployed)
- ❌ Automatic logoff (not implemented)
- ❌ Integrity verification mechanisms (not implemented)

### 2.3 Multi-Factor Authentication (MFA) - Now Required

**Proposed Requirement:**
Implement MFA on all systems that store, transmit, or access ePHI, including:
- EHR platforms
- Cloud services
- Medical devices
- Third-party vendor portals
- **SaaS applications like FlashNote**

**What Qualifies as MFA:**
Combination of two or more factors:
1. Something you know (password)
2. Something you have (phone, hardware token, authenticator app)
3. Something you are (biometrics)

**FlashNote Status:** ❌ Not implemented (password-only authentication)

**Implementation Notes:**
- TOTP (Time-based One-Time Password) via apps like Google Authenticator, Authy
- SMS-based codes (less secure, not recommended for HIPAA)
- WebAuthn/FIDO2 hardware keys (most secure)
- Recovery codes for account recovery

### 2.4 Encryption Requirements - Now Mandatory

**Proposed Requirement:**
Encryption of ePHI at rest and in transit is explicitly REQUIRED for all systems, with no exceptions.

**NIST Standards Referenced:**

**Data at Rest:**
- **NIST SP 800-111:** Guide to Storage Encryption Technologies for End User Devices
- **Minimum:** AES-128
- **Recommended:** AES-192 or AES-256

**Data in Transit:**
- **NIST SP 800-52 r2:** TLS Guidelines
- **NIST SP 800-77:** IPSec VPN Guidelines
- **Minimum:** TLS 1.2 with modern cipher suites
- **Recommended:** TLS 1.3
- **Prohibited:** SSL, TLS 1.0/1.1, RC4, 3DES
- **Additional:** Perfect Forward Secrecy (PFS)

**FlashNote Status:**
- ✅ **In Transit:** TLS 1.2+ enforced on all HTTPS connections
- ⚠️ **At Rest:** Database encryption not yet deployed in production (PostgreSQL supports transparent encryption)

### 2.5 Vulnerability Scanning and Penetration Testing - Now Required

**Proposed Requirements:**

1. **Vulnerability Scanning:**
   - **Frequency:** At least every 6 months
   - **Scope:** All systems that store, transmit, or process ePHI
   - **Tools:** Automated scanners (e.g., Nessus, OpenVAS, Qualys)
   - **Remediation:** High/critical findings must be addressed promptly

2. **Penetration Testing:**
   - **Frequency:** At least once every 12 months
   - **Scope:** Simulate real-world attacks against web apps, APIs, networks
   - **Methodology:** OWASP Top 10, PTES (Penetration Testing Execution Standard)
   - **Documentation:** Report findings, remediation timeline

**FlashNote Status:**
- ❌ Vulnerability scanning not configured
- ❌ Penetration testing not scheduled
- ⚠️ Partially addressed in [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) as P1 items

### 2.6 Incident Response and 72-Hour Recovery Requirement

**Proposed Requirements:**

1. **Written Security Incident Response Plans:**
   - Document how workforce members report suspected/known incidents
   - Define how the entity will respond to incidents
   - Include escalation procedures, containment, eradication, recovery

2. **72-Hour System Recovery:**
   - Establish written procedures to restore loss of critical ePHI systems and data within 72 hours
   - Prioritize and document critical system recovery
   - Conduct annual tabletop exercises or disaster recovery drills

3. **Testing and Revision:**
   - Implement written procedures for testing and revising incident response plans
   - Update plans based on lessons learned

**FlashNote Status:**
- ❌ Incident response plan not documented
- ❌ 72-hour recovery procedures not documented
- ❌ No disaster recovery testing

**Note:** This is separate from the existing breach notification requirement (notify covered entity within 72 hours of discovering a breach). The new 72-hour requirement is about operational resilience - restoring systems after an outage or attack.

### 2.7 Annual Compliance Audits - Now Required

**Proposed Requirement:**
Regulated entities must conduct a compliance audit at least once every 12 months to ensure adherence to Security Rule requirements.

**Audit Scope:**
- Review all implemented technical, administrative, and physical safeguards
- Verify controls are operating as intended
- Document findings and remediation actions
- Retain audit records for 6 years

**FlashNote Status:** ❌ No documented annual audit process

### 2.8 Network Segmentation - Now Required

**Proposed Requirement:**
Implement network segmentation to isolate systems containing ePHI from other network resources, reducing the attack surface.

**Examples:**
- VLANs to separate ePHI systems from general corporate networks
- Firewalls between application tiers
- Micro-segmentation in cloud environments

**FlashNote Status:** ⚠️ Cloud-hosted (Vercel, database provider) - segmentation handled by infrastructure provider; verify with BAA

---

## 3. Business Associate Agreement (BAA) Requirements

### 3.1 What Services Require a BAA?

Any third-party service that creates, receives, maintains, or transmits ePHI on behalf of FlashNote (as a Business Associate) must have a signed BAA. This creates a "BAA chain" from the covered entity (PT clinic) → FlashNote → subcontractors.

### 3.2 FlashNote's Subcontractors

| Service | Purpose | ePHI Exposure | BAA Required? | Status |
|---------|---------|---------------|---------------|--------|
| **Google Cloud (Vertex AI / Gemini API)** | LLM processing of patient notes | ✅ Yes (receives full SOAP note content) | ✅ Yes | ❌ Not signed ([Roadmap line 109](./ROADMAP.md#L109)) |
| **Vercel** | Hosting for web app | ⚠️ Possible (error logs, session data) | ✅ Yes | ❌ Not signed |
| **Database Provider** (e.g., Supabase, AWS RDS) | PostgreSQL hosting | ⚠️ Possible (audit logs contain user IDs linked to PHI events) | ✅ Yes | ❌ Not determined |
| **Sentry** | Error monitoring | ⚠️ Possible (if errors contain PHI) | ✅ Yes | ⚠️ BAA available ([search results](https://sentry.io/legal/baa/)), not signed |
| **Stripe** | Payment processing | ❌ No (billing info only, no PHI) | ❌ No | N/A - Stripe does not offer BAA |

### 3.3 Google Gemini BAA Details

**Availability:**
- Google will sign a BAA for Gemini, but ONLY when used within **Google Cloud** or **Google Workspace** HIPAA-eligible services
- Consumer versions (Bard, general Google accounts) are **NOT HIPAA compliant** and must never be used with PHI

**Coverage Restrictions:**
- BAA applies only to Gemini when used as part of Google's HIPAA-eligible covered services (Vertex AI)
- BAA explicitly states: "This BAA does not apply to (a) any other Google product, service, or feature that is not a Covered Service; or (b) any PHI that Customer creates, receives, maintains, or transmits outside of the Covered Services"

**Additional Requirements Beyond BAA:**
- Proper security controls (encryption, access restrictions)
- Staff training on HIPAA-compliant use
- Configuration to ensure PHI stays within covered services

**How to Sign:**
- Google Workspace customers: [HIPAA BAA page](https://workspace.google.com/terms/2015/1/hipaa_baa/)
- Google Cloud customers: Contact sales or account manager
- Must have existing Google services agreement

**FlashNote Action Item:** Verify Vertex AI usage is covered under Google Cloud's BAA. If using consumer Gemini API endpoint, migrate to Vertex AI enterprise endpoint.

### 3.4 Vercel BAA Details

**Availability:**
- ✅ Vercel offers BAA for **Pro and Enterprise plans**
- Previously Enterprise-only, now self-serve via dashboard for Pro teams

**Coverage:**
- Vercel acts as Business Associate for HIPAA-compliant workloads
- Implements appropriate technical and organizational security measures for PHI
- Provides breach notification without undue delay

**How to Sign:**
- Enterprise customers: Contact Vercel sales
- Pro customers: Self-serve through dashboard

**FlashNote Status:** ❌ Not signed. Web app currently hosted on Vercel but no BAA in place.

### 3.5 Sentry BAA Details

**Availability:**
- ✅ Sentry offers BAA for error monitoring and crash reporting services
- BAA amends standard agreement to reflect rights/responsibilities for PHI processing

**Coverage:**
- Applies only to Sentry's processing of PHI for customers in their capacity as Covered Entity or Business Associate
- Requires customer to configure Sentry to avoid capturing PHI in error reports

**FlashNote Implementation:**
- ✅ `beforeSend` hooks implemented to strip PHI-sensitive fields
- ⚠️ BAA not yet signed

**How to Sign:**
- Contact Sentry sales or account manager
- Available for Business and Enterprise plans

### 3.6 Stripe - No BAA Available

**Status:**
Stripe is **NOT HIPAA compliant** for handling PHI and **does not provide a Business Associate Agreement** for its core payments platform.

**Why FlashNote Can Still Use Stripe:**
Payment processing falls under the **"payment processing" exception** in HIPAA. Financial information (credit cards, billing addresses) is NOT considered PHI under HIPAA, even when the payer is a healthcare provider.

**Critical Compliance Requirements:**
1. **Never store PHI in Stripe metadata**
   - ❌ Don't use patient names, diagnoses, treatment details in customer descriptions
   - ✅ Use generic clinic names, practitioner names (not PHI)

2. **Use generic transaction descriptors**
   - ❌ "SOAP note for John Doe knee injury"
   - ✅ "FlashNote monthly subscription"

3. **Avoid PHI in all Stripe fields:**
   - Customer names → Clinic/organization name (not patient)
   - Descriptions → Service type only
   - Invoice line items → Generic descriptions

**FlashNote Status:** ✅ Stripe integration uses generic descriptors, no PHI exposure

---

## 4. FlashNote-Specific Requirements

### 4.1 Pass-Through Architecture Considerations

FlashNote's architecture **does NOT store patient notes** - PHI is processed in-browser and transmitted to Google Gemini API for SOAP note generation, then returned to the user. This is a **pass-through model**.

**Does Pass-Through Eliminate HIPAA Requirements?**
**No.** HIPAA applies to entities that create, receive, maintain, **or transmit** ePHI. Even without storage, FlashNote is subject to full HIPAA Security Rule compliance because we:
1. ✅ Receive PHI from users (browser extension input)
2. ✅ Transmit PHI to third parties (Google Gemini API)
3. ✅ Process PHI (generate SOAP notes)

### 4.2 Audit Logging Requirements for Pass-Through Systems

**What Must Be Logged (Even Without PHI Storage):**

**Required Events:**
- User authentication (login, logout, token refresh, MFA challenges)
- Authorization failures (access denied events)
- Note generation requests (timestamp, user ID, success/failure)
- Session creation/termination
- Password changes, account lockouts
- Invite code usage (for beta access control)

**Metadata to Capture:**
- User ID (unique identifier)
- Timestamp (ISO 8601 format with timezone)
- Action type (enum of audit actions)
- IP address (source of request)
- User agent (for device tracking)
- Success/failure status
- Error codes (if applicable)

**What Must NEVER Be Logged:**
- ❌ Patient names, dates of birth, medical record numbers
- ❌ Note content (input or generated SOAP notes)
- ❌ Diagnosis, treatment details
- ❌ Any PHI-containing request/response bodies

**FlashNote Status:**
- ✅ Audit logging implemented for auth events
- ✅ Note generation logged (metadata only, no content)
- ⚠️ Missing: Failed authorization attempts, session terminations
- ❌ No automated retention enforcement (6-year requirement)
- ❌ No tamper-proof protections

### 4.3 Browser Extension-Specific Considerations

**Unique HIPAA Challenges:**

1. **Client-Side PHI Processing:**
   - Extension processes PHI in browser memory before transmission
   - Must ensure PHI is cleared from memory on logout/session end
   - Rule 4 in CLAUDE.md: Clear PHI from client state on logout

2. **Chrome Web Store Distribution:**
   - Extension updates pushed automatically by Google
   - Must maintain security controls through update cycle
   - Version control and change management critical

3. **Content Script Injection:**
   - Extension runs in context of EMR web pages
   - Must not leak PHI to page context or other extensions
   - Isolate PHI handling in background scripts with message passing

4. **Local Storage:**
   - `chrome.storage.local` used for auth tokens
   - Must encrypt sensitive data at rest (tokens)
   - Must clear on logout (Rule 4)

5. **Clipboard Access:**
   - SOAP notes copied to clipboard for pasting into EMR
   - Must clear clipboard on logout if SOAP content was copied
   - Must handle copy failures gracefully (UI Audit finding 2.1)

**FlashNote Status:**
- ✅ PHI cleared from state on logout
- ✅ Tokens stored in `chrome.storage.local` (not localStorage)
- ⚠️ Tokens not encrypted at rest in browser storage
- ❌ Clipboard not cleared on logout (UI Audit finding)
- ❌ Silent clipboard failures (UI Audit finding 2.1)

### 4.4 Session Management Requirements

**HIPAA Expectations:**

1. **Session Timeout (Automatic Logoff):**
   - **Current:** Addressable under §164.312(a)(2)(iii)
   - **NPRM:** Will become REQUIRED
   - **Recommended:** 5-15 minutes of inactivity for ePHI systems
   - **FlashNote Status:** ⚠️ Access tokens expire in 1 hour, but no client-side inactivity detection

2. **Session Termination:**
   - Explicit logout must clear all session state
   - Tokens must be revoked server-side
   - PHI must be cleared from client memory
   - **FlashNote Status:** ✅ Logout implemented with token revocation and state clearing

3. **Concurrent Session Limits:**
   - Not required by HIPAA, but recommended for security
   - **FlashNote Status:** ❌ Not implemented (users can have unlimited active sessions)

4. **Session Fixation Prevention:**
   - Regenerate session identifiers after authentication
   - **FlashNote Status:** ✅ New JWT issued on login (not session fixation vulnerable)

**Implementation Gap:**
FlashNote needs to implement client-side inactivity detection with automatic logout. Recommended approach:
- Detect user activity (mouse, keyboard, API calls)
- Track last activity timestamp
- Show warning modal at 13-14 minutes of inactivity
- Auto-logout at 15 minutes
- Clear all PHI from state and storage

---

## 5. Developer Resources

### 5.1 Official HHS/OCR Resources

**Primary Regulatory Text:**
- [45 CFR Part 160 and Part 164, Subparts A and C](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164) - Full text of Security Rule
- [45 CFR § 164.308 - Administrative Safeguards](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.308)
- [45 CFR § 164.312 - Technical Safeguards](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.312)

**HHS Office for Civil Rights (OCR):**
- [Summary of the HIPAA Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [The Security Rule](https://www.hhs.gov/hipaa/for-professionals/security/index.html) - Main OCR portal
- [Security Rule Guidance Material](https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html)
- [Guidance on Risk Analysis](https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html)

**HHS Security Series Papers (Official Implementation Guides):**
- [Volume 2 / Paper 1: Security 101 for Covered Entities](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/security101.pdf) (PDF)
- [Volume 2 / Paper 4: Technical Safeguards](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/techsafeguards.pdf) (PDF)
- [Volume 2 / Paper 5: Organizational, Policies, and Procedures](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/pprequirements.pdf) (PDF)

### 5.2 2025 NPRM Documents

**Official NPRM:**
- [Federal Register: HIPAA Security Rule To Strengthen the Cybersecurity of Electronic Protected Health Information](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information) - Full proposed rule text
- [HIPAA Security Rule NPRM | HHS.gov](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/index.html) - OCR summary page
- [HIPAA Security Rule NPRM Fact Sheet](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html) - Executive summary

### 5.3 NIST Standards (Referenced by HIPAA)

**Encryption Standards:**
- [NIST SP 800-111: Guide to Storage Encryption Technologies for End User Devices](https://csrc.nist.gov/publications/detail/sp/800-111/final) - Data at rest encryption
- [NIST SP 800-52 Rev. 2: Guidelines for the Selection, Configuration, and Use of TLS](https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final) - TLS configuration
- [NIST SP 800-77: Guide to IPsec VPNs](https://csrc.nist.gov/publications/detail/sp/800-77/rev-1/final) - VPN encryption

**Risk Management:**
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework) - Widely adopted framework (not HIPAA-specific but useful)
- [NIST HIPAA Security Toolkit Application](https://csrc.nist.gov/projects/security-content-automation-protocol/scap-releases/scap-1-2) - Self-assessment survey (note: may be outdated)

### 5.4 Practical Developer Guides

**Comprehensive Guides:**
- [HIPAA Security Rule Standards Map (AccountableHQ)](https://www.accountablehq.com/post/hipaa-security-rule-standards-map-linking-45-cfr-164-308-164-310-164-312-and-164-316-to-real-world-controls) - Links CFR sections to real-world technical controls
- [HIPAA Compliance for SaaS: A Complete Guide (Drata)](https://drata.com/blog/hipaa-compliance-saas-guide) - SaaS-focused implementation guide
- [HIPAA Compliance Checklist (Cynomi)](https://cynomi.com/learn/hipaa-compliance-checklist/) - Comprehensive checklist
- [The Technical Guide to Meet HIPAA Compliance (Romexsoft)](https://www.romexsoft.com/blog/technical-guide-to-hipaa-compliance/) - Developer-focused technical guide

**Specific Topics:**
- [HIPAA Audit Logs: Developer's Comprehensive Guide (Pangea)](https://pangea.cloud/blog/hipaa-audit-log-requirements/) - Detailed audit logging implementation
- [HIPAA Encryption Requirements - 2026 Update (HIPAA Journal)](https://www.hipaajournal.com/hipaa-encryption-requirements/) - Current encryption standards
- [HIPAA Compliance with LLMs Best Practices (Cloudticity)](https://blog.cloudticity.com/hipaa-compliance-llms-best-practices) - AI/LLM-specific guidance

**Checklists:**
- [HIPAA Compliance Checklist for SaaS Apps (Metomic)](https://www.metomic.io/resource-centre/the-ultimate-guide-to-hipaa) - SaaS-specific requirements
- [HIPAA Security Checklist (Holland & Hart)](https://www.hollandhart.com/pdf/hipaa_checklist.pdf) (PDF) - Comprehensive technical + administrative checklist

### 5.5 Tools and Automation

**Risk Assessment:**
- [HHS/ONC HIPAA Security Risk Assessment Tool](https://www.healthit.gov/topic/privacy-security-and-hipaa/security-risk-assessment-tool) - Free official tool from HHS

**Vulnerability Scanning:**
- [OWASP ZAP](https://www.zaproxy.org/) - Free, open-source DAST scanner
- [Nessus Essentials](https://www.tenable.com/products/nessus/nessus-essentials) - Free vulnerability scanner (limited to 16 IPs)
- [OpenVAS](https://www.openvas.org/) - Open-source vulnerability scanner

**Penetration Testing Frameworks:**
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) - Web application security testing methodology
- [Penetration Testing Execution Standard (PTES)](http://www.pentest-standard.org/) - Industry-standard pentesting methodology

**Compliance Monitoring:**
- [Drata](https://drata.com/) - Automated HIPAA compliance monitoring (commercial)
- [Vanta](https://www.vanta.com/) - Compliance automation platform (commercial)
- [Secureframe](https://secureframe.com/) - HIPAA compliance automation (commercial)

---

## 6. Implementation Roadmap

### 6.1 Immediate Priorities (Pre-Launch Blockers)

These items are **required before FlashNote can legally process real PHI in production** under current HIPAA requirements:

| Priority | Item | CFR Section | Current Status | Estimated Effort |
|----------|------|-------------|----------------|------------------|
| **P0** | Sign Google Cloud Vertex AI BAA | §164.308(b)(1) | ❌ Not done | 1-2 weeks (legal review) |
| **P0** | Sign Vercel BAA (or migrate to HIPAA-compliant host) | §164.308(b)(1) | ❌ Not done | 1-2 weeks (sales process) |
| **P0** | Sign database provider BAA | §164.308(b)(1) | ❌ Not done | 1-2 weeks (vendor dependent) |
| **P0** | Deploy database encryption at rest | §164.312(a)(2)(iv) | ⚠️ Addressable | 1-3 days (config + testing) |
| **P0** | Implement audit log retention automation (6 years) | §164.316(b)(2)(i) | ❌ Not done | 3-5 days (cron job + storage policy) |
| **P0** | Add tamper-proof protections to audit logs | §164.312(b) | ❌ Not done | 1 week (WORM storage or cryptographic hashing) |
| **P0** | Document incident response plan | §164.308(a)(6) | ❌ Not done | 3-5 days (documentation + review) |
| **P1** | Fix silent clipboard copy failure | UI Audit 2.1 | ❌ Not done | 1 day (error handling) |
| **P1** | Clear clipboard on logout if SOAP content copied | Rule 4, §164.312(a)(2)(iii) | ❌ Not done | 1 day |
| **P1** | Conduct formal risk analysis | §164.308(a)(1)(ii)(A) | ❌ Not done | 1-2 weeks (workshop + documentation) |

**Total Estimated Effort (Critical Path):** 6-9 weeks, primarily blocked on vendor BAA processes

### 6.2 NPRM Preparation (Due ~November 2026 if finalized)

These items are **not yet required** under current regulations but will likely become mandatory when the NPRM is finalized (expected May 2026 with 180-day compliance period):

| Priority | Item | NPRM Section | Current Status | Estimated Effort |
|----------|------|--------------|----------------|------------------|
| **P0** | Implement multi-factor authentication (MFA) | New requirement | ❌ Not done | 2-3 weeks (TOTP + WebAuthn support) |
| **P0** | Implement automatic session timeout (15 min inactivity) | §164.312(a)(2)(iii) | ⚠️ Partial | 3-5 days (client-side activity tracking) |
| **P1** | Configure vulnerability scanning (6-month intervals) | New requirement | ❌ Not done | 1 week (OWASP ZAP automation) |
| **P1** | Schedule annual penetration testing | New requirement | ❌ Not done | Ongoing (vendor selection + budget) |
| **P1** | Document 72-hour system recovery procedures | New requirement | ❌ Not done | 1 week (disaster recovery plan) |
| **P1** | Implement annual compliance audit process | New requirement | ❌ Not done | 2-3 days (checklist + schedule) |
| **P2** | Add ePHI integrity verification mechanisms | §164.312(c)(2) | ❌ Not done | 1 week (checksums, digital signatures) |

**Total Estimated Effort:** 6-8 weeks (can be parallelized with P0 items)

### 6.3 Recommended Phased Approach

**Phase 1: Legal Foundation (Weeks 1-4)**
- Start BAA negotiations with Google Cloud, Vercel, database provider (parallel track)
- Conduct formal risk analysis workshop
- Document incident response plan
- Document 72-hour recovery procedures

**Phase 2: Technical Quick Wins (Weeks 2-5)**
- Deploy database encryption at rest
- Implement audit log retention automation
- Fix clipboard copy failure handling
- Clear clipboard on logout
- Add client-side session timeout

**Phase 3: Authentication Hardening (Weeks 6-8)**
- Implement TOTP-based MFA (mandatory, foundational)
- Add WebAuthn/FIDO2 support (optional, enhanced security)
- Add recovery codes for account recovery

**Phase 4: Audit and Testing Infrastructure (Weeks 9-11)**
- Configure OWASP ZAP for automated vulnerability scanning
- Add cryptographic hashing to audit logs (tamper-proof)
- Create annual compliance audit checklist
- Schedule first penetration test

**Phase 5: Post-Launch Monitoring (Ongoing)**
- Run vulnerability scans every 6 months
- Conduct penetration tests annually
- Review and update incident response plan annually
- Perform annual compliance audits

### 6.4 Budget Considerations

**One-Time Costs:**
- Legal review of BAAs: $2,000-5,000
- First penetration test: $5,000-15,000 (depending on scope)
- Third-party security audit (optional): $15,000-50,000

**Recurring Costs:**
- Vercel Pro plan (for BAA): ~$20/month minimum
- Google Cloud Vertex AI costs: Variable (usage-based)
- Database hosting with encryption: +10-20% vs standard hosting
- Annual penetration testing: $5,000-15,000/year
- Compliance automation tools (Drata/Vanta): $1,500-3,000/month (optional)
- Vulnerability scanning tools: $0-500/month (free tier available)

**Estimated Total First-Year Cost:** $30,000-80,000 (excluding compliance automation SaaS)

---

## Sources

**Official HIPAA Regulations:**
- [Federal Register: HIPAA Security Rule To Strengthen the Cybersecurity of Electronic Protected Health Information](https://www.federalregister.gov/documents/2025/01/06/2024-30983/hipaa-security-rule-to-strengthen-the-cybersecurity-of-electronic-protected-health-information)
- [Summary of the HIPAA Security Rule | HHS.gov](https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html)
- [eCFR § 45 CFR Part 164 Subpart C - Security Standards for the Protection of Electronic Protected Health Information](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C)
- [eCFR § 45 CFR 164.308 - Administrative safeguards](https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C/section-164.308)

**2025 NPRM Information:**
- [HIPAA Security Rule | Prepare for Compliance Changes in Q4 2025](https://www.hipaavault.com/resources/hipaa-security-rule-updates-2025/)
- [HIPAA Security Rule 2025: Say Goodbye to "Good Enough" | Coalfire](https://coalfire.com/the-coalfire-blog/hipaa-security-rule-2025-say-goodbye-to-good-enough)
- [HIPPA Changes Mandatory Controls for 2025 | Johnson Lambert](https://www.johnsonlambert.com/insights/articles/hipaas-security-shake-up-mandatory-controls-and-enhanced-enforcement-for-2025/)
- [2025 HIPAA Updates: Key Changes Every Organization Must Know | MetricStream](https://www.metricstream.com/blog/hipaa-updates-2025-key-changes.html)
- [HIPAA Security Rule NPRM | HHS.gov](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/index.html)
- [HIPAA Security Rule NPRM Fact Sheet](https://www.hhs.gov/hipaa/for-professionals/security/hipaa-security-rule-nprm/factsheet/index.html)

**Technical Safeguards:**
- [HIPAA Security Rule Technical Safeguards: The Complete Requirements List (45 CFR §164.312)](https://www.accountablehq.com/post/hipaa-security-rule-technical-safeguards-the-complete-requirements-list-45-cfr-164-312)
- [HIPAA Encryption Requirements - 2026 Update](https://www.hipaajournal.com/hipaa-encryption-requirements/)

**Session Timeout and Access Controls:**
- [Automatic Logoff Policy (UBIT HIPAA) - University at Buffalo](https://www.buffalo.edu/ubit/policies/restricted-data/laws/hipaa/automatic-logoff.html)
- [HIPAA: Automatic Logoff Procedures under Access Control](https://compliancy-group.com/automatic-logoff-procedures-under-the-hipaa-security-rule/)
- [Automatic Logoff: Avoid "Unattended Screen" Fines](https://www.complydome.com/compliance-resources/is-automatic-logoff-required-by-hipaa-a-guide-to-the-addressable-safeguard-45-cfr-164312a1iii)
- [HIPAA Compliance: Session Timeout Rules | Censinet](https://censinet.com/perspectives/hipaa-compliance-session-timeout-rules)

**Business Associate Agreements:**
- [Guide to HIPAA Compliance for Google Workspace and Google Gemini](https://upcurvecloud.com/blog/guide-to-hipaa-compliance-for-google-workspace-and-google-gemini/)
- [Is Google Gemini HIPAA Compliant? | Nightfall AI](https://www.nightfall.ai/blog/is-google-gemini-hipaa-compliant)
- [Using LLMs Under HIPAA: ChatGPT & Gemini](https://www.hipaavault.com/resources/hipaa-compliant-hosting-insights/hipaa-compliant-llm-chatgpt-gemini/)
- [Is Google's AI Gemini 3 HIPAA compliant? (2026 update)](https://www.paubox.com/blog/is-googles-ai-gemini-hipaa-compliant)
- [Google Workspace HIPAA Business Associate Amendment](https://workspace.google.com/terms/2015/1/hipaa_baa/)
- [Is Stripe HIPAA Compliant?](https://www.hipaajournal.com/is-stripe-hipaa-compliant/)
- [Does Vercel support HIPAA compliance? | Vercel KB](https://vercel.com/kb/guide/is-vercel-hipaa-compliant)
- [HIPAA BAAs are now available to Pro teams - Vercel](https://vercel.com/changelog/hipaa-baas-are-now-available-to-pro-teams)
- [Business Associate Amendment 1.0.1 (January 15, 2026) | Sentry](https://sentry.io/legal/baa/)

**Encryption Standards:**
- [HIPAA Encryption Rules for Data in Transit | Censinet](https://censinet.com/perspectives/hipaa-encryption-rules-for-data-in-transit)
- [TLS & HIPAA Compliance | Is Encrypting Transmissions Enough?](https://www.hipaavault.com/resources/is-tls-enough-for-hipaa/)
- [HIPAA Data Encryption: A Beginner's Guide](https://www.accountablehq.com/post/hipaa-data-encryption-a-beginner-s-guide-to-what-you-need-to-know)
- [HIPAA Encryption Requirements: An Updated Guide](https://drata.com/blog/hipaa-encryption-requirements)
- [AES-256 Encryption for HIPAA: Breach Safe Harbor Guide](https://www.kiteworks.com/hipaa-compliance/hipaa-encryption-requirements-safe-harbor-guide/)

**Audit Logging:**
- [HIPAA Audit Logs: Complete Requirements for Healthcare Compliance in 2025](https://www.kiteworks.com/hipaa-compliance/hipaa-audit-log-requirements/)
- [HIPAA Audit Logs: Developer's Comprehensive Guide](https://pangea.cloud/blog/hipaa-audit-log-requirements/)
- [Should HIPAA Audit Logs be Kept for 6 Years?](https://www.ispartnersllc.com/blog/hipaa-audit-log-retention-six-years/)
- [HIPAA logging requirements and how to ensure compliance | NXLog](https://nxlog.co/news-and-blog/posts/hipaa-compliance)

**NPRM Changes:**
- [HIPAA NPRM: A New Era of Healthcare Cybersecurity & Compliance](https://www.avertium.com/blog/hipaa-notice-of-proposed-rulemaking-a-new-era-of-healthcare-cybersecurity-compliance)
- [HIPAA Vulnerability Scanning Requirements](https://www.essendis.com/post/hipaa-vulnerability-scanning-requirements-2025-compliance-checklist)
- [Key Updates in the HIPAA Security Rule NPRM](https://about.citiprogram.org/blog/strengthening-cybersecurity-key-updates-in-the-hipaa-security-rule-nprm/)
- [HHS Publishes NPRM to Amend HIPAA Security Rule Requirements](https://www.triagehealthlawblog.com/data-protection/hhs-publishes-notice-of-proposed-rulemaking-to-amend-hipaa-security-rule-requirements-comments-due-march-7-2025/)
- [HIPAA Security Rule Overhaul: Start Planning Now | Koley Jessen](https://www.koleyjessen.com/insights/publications/hipaa-security-rule-overhaul-start-planning-now)
- [Top 10 takeaways from the new HIPAA security rule NPRM | Bradley](https://www.bradley.com/insights/publications/2025/03/top-10-takeaways-from-the-new-hipaa-security-rule-nprm)

**Developer Guides:**
- [HIPAA Compliance Checklist for SaaS Apps | Metomic](https://www.metomic.io/resource-centre/the-ultimate-guide-to-hipaa)
- [HIPAA Compliance for SaaS: A Complete Guide | Drata](https://drata.com/blog/hipaa-compliance-saas-guide)
- [HIPAA Compliance Checklist | Cynomi](https://cynomi.com/learn/hipaa-compliance-checklist/)
- [HIPAA-Compliant Healthcare SaaS Development Guide 2026](https://scalevista.com/blog/hipaa-compliant-healthcare-saas-development/)
- [The Technical Guide to Meet HIPAA Compliance - Romexsoft](https://www.romexsoft.com/blog/technical-guide-to-hipaa-compliance/)

**LLM/AI-Specific Guidance:**
- [HIPAA Compliance AI: Guide to Using LLMs Safely in Healthcare | TechMagic](https://www.techmagic.co/blog/hipaa-compliant-llms)
- [Best Practices for HIPAA Compliance of LLMs | Cloudticity](https://blog.cloudticity.com/hipaa-compliance-llms-best-practices)
- [Designing HIPAA-Compliant LLMs: The Technical Blueprint](https://purelogics.com/designing-hipaa-compliant-llms/)

**Official Guidance Documents:**
- [Security Rule Guidance Material | HHS.gov](https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html)
- [Guidance on Risk Analysis | HHS.gov](https://www.hhs.gov/hipaa/for-professionals/security/guidance/guidance-risk-analysis/index.html)
- [HHS Security 101 for Covered Entities (PDF)](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/security101.pdf)
- [HHS Technical Safeguards (PDF)](https://www.hhs.gov/sites/default/files/ocr/privacy/hipaa/administrative/securityrule/techsafeguards.pdf)

---

**Document History:**
- **2026-02-15:** Initial research and documentation (Claude Code)
