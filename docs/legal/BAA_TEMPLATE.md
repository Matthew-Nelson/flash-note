# Business Associate Agreement Template

**BUSINESS ASSOCIATE AGREEMENT**

This Business Associate Agreement ("Agreement") is entered into as of [DATE] ("Effective Date") by and between:

**Covered Entity:** [CLINIC/PRACTICE NAME]
**Address:** [ADDRESS]

and

**Business Associate:** FlashNote
**Address:** [FLASHNOTE ADDRESS]

## RECITALS

WHEREAS, Covered Entity is a "covered entity" as defined by the Health Insurance Portability and Accountability Act of 1996 ("HIPAA"), as amended by the Health Information Technology for Economic and Clinical Health Act of 2009 ("HITECH Act"), and their implementing regulations;

WHEREAS, Business Associate provides AI-powered documentation services to Covered Entity;

WHEREAS, Business Associate may receive and transmit Protected Health Information ("PHI") in the course of providing services using a pass-through processing model as described herein;

NOW, THEREFORE, the parties agree as follows:

## 1. DEFINITIONS

Terms used but not otherwise defined in this Agreement shall have the same meaning as those terms in HIPAA and the HITECH Act.

**1.1 "Protected Health Information" or "PHI"** means any information, including demographic information, that relates to the past, present, or future physical or mental health or condition of an individual, or the provision of health care to an individual, that identifies the individual or could reasonably be used to identify the individual.

**1.2 "Pass-Through Processing Model"** means the data handling architecture used by Business Associate in which PHI is:
- Received from Covered Entity via encrypted transmission
- Processed in memory for the sole purpose of generating clinical documentation
- Transmitted to HIPAA-compliant third-party AI services for processing
- Returned to Covered Entity in the form of generated documentation
- **Not stored, retained, or persisted** by Business Associate beyond the duration of the individual processing request

Business Associate does not maintain a database, file system, or any other persistent storage containing PHI. All PHI exists only transiently during active processing requests.

## 2. OBLIGATIONS OF BUSINESS ASSOCIATE

Business Associate agrees to:

**2.1** Not use or disclose PHI other than as permitted by this Agreement or as required by law.

**2.2** Use appropriate safeguards to prevent unauthorized use or disclosure of PHI.

**2.3** Report to Covered Entity any use or disclosure of PHI not provided for by this Agreement within 72 hours of discovery.

**2.4** Ensure that any subcontractors that create, receive, or transmit PHI agree to the same restrictions and conditions. Business Associate uses HIPAA-compliant artificial intelligence services to process documentation requests. Business Associate maintains current Business Associate Agreements with all such subcontractors and will provide confirmation of such agreements upon request.

**2.5** Due to the Pass-Through Processing Model described in Section 1.2, Business Associate does not retain PHI after processing. Covered Entity maintains all original PHI and is responsible for providing individual access. Business Associate will cooperate with reasonable requests related to access rights.

**2.6** Due to the Pass-Through Processing Model described in Section 1.2, Business Associate does not retain PHI that could be amended. Covered Entity maintains control of all PHI and any amendments thereto.

**2.7** Business Associate maintains audit logs of all processing requests, including timestamps, user identifiers, and request metadata (but not PHI content). These logs are available to support Covered Entity's accounting of disclosures obligations upon reasonable request.

**2.8** Make internal practices, books, and records relating to PHI available to the Secretary of HHS for purposes of determining compliance.

## 3. PERMITTED USES AND DISCLOSURES

**3.1** Business Associate may use and disclose PHI only as necessary to perform services for Covered Entity as described in the underlying service agreement.

**3.2** Business Associate may use PHI for its proper management and administration.

**3.3** Business Associate may disclose PHI if required by law.

## 4. SECURITY REQUIREMENTS

Business Associate shall:

**4.1** Implement administrative, physical, and technical safeguards as required by the HIPAA Security Rule, as strengthened by the HITECH Act.

**4.2** Ensure the confidentiality, integrity, and availability of electronic PHI.

**4.3** Protect against reasonably anticipated threats or hazards.

**4.4** Protect against unauthorized uses or disclosures.

**4.5** Ensure compliance by its workforce.

## 5. BREACH NOTIFICATION

**5.1** In accordance with the HITECH Act Breach Notification Rule (45 CFR §§ 164.400–414), Business Associate shall notify Covered Entity of any breach of unsecured PHI within 72 hours of discovery.

**5.2** Notification shall include:
- The nature of the breach
- Types of information involved
- Identity of individuals affected (if known)
- Steps being taken to investigate and mitigate

**5.3** Business Associate acknowledges that, under the HITECH Act, the burden of proof rests with Business Associate to demonstrate that any unauthorized access, use, or disclosure did not constitute a breach of unsecured PHI.

## 6. TERM AND TERMINATION

**6.1** This Agreement shall remain in effect for the duration of the service relationship.

**6.2** Either party may terminate this Agreement if the other party is in material breach and fails to cure within 30 days of notice.

**6.3** Upon termination, Business Associate shall certify in writing that no PHI is retained. Due to the Pass-Through Processing Model described in Section 1.2, Business Associate does not maintain persistent storage of PHI. Audit logs (which do not contain PHI) will be retained as required by HIPAA retention requirements.

## 7. GENERAL PROVISIONS

**7.1** This Agreement may not be modified except in writing signed by both parties.

**7.2** Any ambiguity shall be resolved in favor of a meaning that permits compliance with HIPAA and the HITECH Act.

**7.3** This Agreement shall be governed by [STATE] law.

## SIGNATURES

**COVERED ENTITY:**

Signature: _________________________
Name: _________________________
Title: _________________________
Date: _________________________

**BUSINESS ASSOCIATE (FlashNote):**

Signature: _________________________
Name: _________________________
Title: _________________________
Date: _________________________

---

## EXHIBIT A: SUBCONTRACTOR COMPLIANCE

Business Associate utilizes HIPAA-compliant artificial intelligence services for PHI processing. Business Associate represents and warrants that:

1. All AI service providers used for PHI processing are covered by valid Business Associate Agreements
2. All PHI transmitted to subcontractors is encrypted in transit using TLS 1.2 or higher
3. Business Associate will notify Covered Entity of any material changes to subcontractor arrangements within 30 days
4. A current list of subcontractors is available upon request

---

*This is a template and has not been reviewed by legal counsel. Have this document reviewed by a legal professional specializing in healthcare compliance before use. The Pass-Through Processing Model language is specific to FlashNote's architecture and should be verified against actual technical implementation.*
