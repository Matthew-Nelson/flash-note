# FlashNote Incident Response Plan

**Created:** February 2026
**Last Updated:** February 2026
**Owner:** FlashNote Security Team
**Review Cycle:** Annual (next review: February 2027)

**Regulatory Basis:** HIPAA Security Rule (45 CFR §§ 164.308, 164.312), HIPAA Breach Notification Rule (45 CFR §§ 164.400–414), HITECH Act § 13402

---

## 1. Purpose and Scope

This plan establishes procedures for detecting, responding to, and recovering from security incidents affecting FlashNote's systems and data. It covers all security events, with specific procedures for incidents involving Protected Health Information (PHI) that trigger HIPAA/HITECH breach notification obligations.

**In scope:**
- Unauthorized access to FlashNote systems or data
- Suspected or confirmed PHI breaches
- Infrastructure compromise (servers, databases, cloud services)
- Application-level security events (injection, authentication bypass)
- Credential compromise (API keys, database credentials, service accounts)
- Insider threats or policy violations
- Third-party/subprocessor security incidents affecting FlashNote data

**Out of scope:**
- Covered Entity breaches not involving FlashNote systems
- General IT support issues without security implications

---

## 2. Definitions

**Security Incident:** An attempted or successful unauthorized access, use, disclosure, modification, or destruction of information or interference with system operations in an information system (per 45 CFR § 164.304).

**Breach:** The acquisition, access, use, or disclosure of PHI in a manner not permitted under the HIPAA Privacy Rule which compromises the security or privacy of the PHI (per 45 CFR § 164.402). A breach is presumed unless a risk assessment demonstrates a low probability that PHI was compromised.

**Unsecured PHI:** PHI that is not rendered unusable, unreadable, or indecipherable to unauthorized individuals through encryption or destruction consistent with NIST guidelines (per 45 CFR § 164.402).

**Discovery Date:** The first day on which the breach is known to FlashNote, or by exercising reasonable diligence would have been known. This is the date from which notification deadlines are measured.

**Covered Entity:** A health care provider, health plan, or health care clearinghouse that has entered into a BAA with FlashNote.

**Business Associate (BA):** FlashNote, as a service provider handling PHI on behalf of Covered Entities.

---

## 3. FlashNote's PHI Posture

**Current model: Pass-through processing only.**

FlashNote processes PHI transiently during SOAP note generation. User-provided clinical input is sent to Google Vertex AI (Gemini) for processing and the generated note is returned to the user. No PHI is persisted in FlashNote's database, file systems, or logs.

**What FlashNote stores:**
- User account information (email, hashed passwords)
- Audit logs (action metadata only — no clinical content)
- Usage metrics (counts and timestamps — no PHI)
- Billing data (Stripe customer/subscription IDs)

**What FlashNote does NOT store:**
- Patient names, dates of birth, or medical record numbers
- Clinical note content (input or output)
- Diagnosis or treatment details

**Important:** This section must be updated when PHI Storage (Phase 2) is implemented. Persistent storage of patients, clinical notes, and note versions will change the breach impact analysis and notification requirements.

---

## 4. Severity Classification

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|----------|
| **SEV-1** | Confirmed breach of unsecured PHI | Immediate (within 1 hour) | Database exfiltration, unauthorized PHI access, compromised credentials with PHI exposure |
| **SEV-2** | Suspected PHI breach or confirmed system compromise | Within 2 hours | Anomalous database queries, unauthorized authentication, infrastructure intrusion detected |
| **SEV-3** | Security incident without suspected PHI involvement | Within 8 hours | DDoS, credential stuffing (blocked by rate limiting), application vulnerability discovered |
| **SEV-4** | Minor security event | Within 24 hours | Failed brute-force attempts (contained), security scanner alerts, policy violation without data exposure |

**Escalation rule:** If severity is uncertain, treat as the higher severity until investigation confirms otherwise.

---

## 5. Incident Response Workflow

### Phase 1: Detection and Triage (0–1 hour)

**Detection sources:**
- Audit log anomalies (unusual `ACCESS_DENIED`, `AUTH_FAILED` patterns)
- Cloud monitoring alerts (Cloud Error Reporting, Cloud Monitoring)
- User reports (support email, direct communication)
- Subprocessor notifications (Google Cloud security advisories)
- Automated scanning results (dependency vulnerabilities, DAST)

**Triage steps:**
1. Confirm the event is a real security incident (not a false positive)
2. Assign severity level (SEV-1 through SEV-4)
3. Record the discovery date and time — this starts the HIPAA notification clock
4. Begin an incident log (see [Section 8: Communication Templates](#8-communication-templates))

### Phase 2: Containment (1–4 hours)

**Immediate containment actions (select as applicable):**

| Action | When |
|--------|------|
| Revoke compromised credentials | Credential compromise suspected |
| Rotate API keys and secrets | Service account or key exposure |
| Invalidate all active sessions (`DELETE FROM sessions`) | Authentication bypass or session hijack |
| Block suspicious IP addresses (Cloud Armor / firewall rules) | Active attack from identifiable source |
| Disable compromised user accounts | Insider threat or account takeover |
| Take affected service offline | Active data exfiltration in progress |

**Do NOT:**
- Delete audit logs (immutability triggers prevent this — migration 012)
- Modify database records to "fix" the breach before investigation
- Communicate externally before facts are established (except as required by BAA §5.1)

### Phase 3: Investigation (4–48 hours)

**Evidence collection:**
1. Preserve audit logs for the relevant time period (immutable — see `backend/src/db/migrations/012_audit_log_immutability.sql`)
2. Export Cloud Logging entries for affected services
3. Capture database query logs if available
4. Document timeline of events with timestamps
5. Identify affected systems, data, and users

**HIPAA four-factor breach risk assessment** (45 CFR § 164.402(2)):

Conduct this assessment for any incident involving PHI to determine whether notification is required:

| Factor | Assessment Question |
|--------|-------------------|
| **1. Nature and extent of PHI** | What types of PHI were involved? (identifiers, clinical data, financial data) How many records? |
| **2. Unauthorized person** | Who accessed the PHI? Was it an authorized workforce member acting outside scope, or a completely unauthorized party? |
| **3. Whether PHI was actually acquired or viewed** | Was the data actually accessed/viewed, or was it only exposed (e.g., server misconfigured but no evidence of access)? |
| **4. Extent of risk mitigation** | What steps were taken to reduce harm? Was the data recovered? Was the unauthorized recipient identified and confirmed to have destroyed the data? |

**Outcome:** If the assessment cannot demonstrate a low probability that PHI was compromised, it is a reportable breach and notification must proceed.

### Phase 4: Notification (within 72 hours of discovery)

**Binding timeline:** FlashNote's BAA (§5.1) commits to notifying Covered Entities within **72 hours** of breach discovery. This is stricter than the HIPAA default for Business Associates (60 days under 45 CFR § 164.410(b)), but it is the contractual obligation.

**Notification recipients and method:**

| Recipient | Method | Deadline | Responsible Party |
|-----------|--------|----------|-------------------|
| Affected Covered Entity(ies) | Email to BAA contact + follow-up written notice | 72 hours from discovery | FlashNote founder / designated security contact |

**Notification must include** (per BAA §5.2 and 45 CFR § 164.410(c)):
- Nature of the breach (what happened)
- Types of information involved
- Identity of individuals affected (if known)
- Steps being taken to investigate and mitigate
- Contact information for follow-up questions

**Important:** Under HITECH, the Covered Entity is responsible for notifying affected individuals and HHS. FlashNote's obligation as a Business Associate is to notify the Covered Entity with sufficient information for them to fulfill their notification duties.

### Phase 5: Remediation (1–30 days)

1. Implement technical fixes to close the vulnerability
2. Verify the fix with testing (penetration test if warranted)
3. Update security controls, monitoring, or alerting as needed
4. Update this incident response plan if process gaps were identified
5. Rotate any credentials that may have been exposed
6. Review and update access controls

### Phase 6: Post-Incident Review (within 14 days of resolution)

1. Conduct a blameless post-incident review
2. Document root cause, timeline, impact, and response effectiveness
3. Identify process improvements and assign owners
4. Update relevant documentation (this plan, AUDIT_LOGGING_REQUIREMENTS, etc.)
5. File the incident report in compliance records (retain for 6 years per HIPAA)
6. Schedule follow-up to verify remediation measures remain effective

---

## 6. Evidence Preservation

**Audit log immutability:** Database triggers (migration 012) prevent UPDATE, DELETE, and TRUNCATE operations on the `audit_logs` table. This ensures audit evidence cannot be tampered with during or after an incident.

**Preservation requirements:**
- Do not modify, delete, or overwrite any logs related to the incident
- Export and archive relevant Cloud Logging entries within 24 hours of detection
- Preserve database query logs for the incident timeframe
- Document all evidence collection with timestamps and chain of custody
- Store incident artifacts (logs, screenshots, reports) in a secured location separate from production systems

**Retention:** All incident documentation must be retained for a minimum of 6 years from the date of resolution (per 45 CFR § 164.530(j)).

---

## 7. Roles and Responsibilities

> **Note:** FlashNote is currently a solo-founder operation. As the team grows, these roles should be distributed across personnel.

| Role | Current Owner | Responsibilities |
|------|--------------|------------------|
| **Incident Commander** | Founder | Overall incident coordination, severity decisions, external communications |
| **Technical Lead** | Founder | Investigation, containment, remediation, evidence collection |
| **Communications Lead** | Founder | Covered Entity notification, drafting breach notices |
| **Compliance Officer** | Founder | HIPAA risk assessment, regulatory obligation tracking, documentation |

**Scaling plan:** When FlashNote hires additional team members:
- Designate a primary and backup for each role
- Establish an on-call rotation for SEV-1/SEV-2 incidents
- Define escalation paths with contact information

---

## 8. Communication Templates

### Template A: Covered Entity Breach Notification

```
Subject: FlashNote Security Incident Notification — [Date]

Dear [Covered Entity Contact],

We are writing to notify you of a security incident affecting FlashNote
in accordance with our Business Associate Agreement (§5).

INCIDENT SUMMARY
- Discovery Date: [Date and time]
- Nature of Incident: [Brief description]
- Types of Information Involved: [e.g., clinical note content, patient identifiers]
- Individuals Potentially Affected: [Number and description, or "under investigation"]

ACTIONS TAKEN
- [Containment measures implemented]
- [Investigation status]
- [Remediation steps planned or completed]

NEXT STEPS
- [Timeline for updates]
- [Contact information for questions]

We take this matter seriously and are committed to full transparency
throughout the investigation and resolution process.

[Name]
FlashNote Security Contact
[Email]
[Phone]
```

### Template B: Internal Incident Log

```
INCIDENT LOG — [Incident ID]

Severity: SEV-[1-4]
Discovery Date/Time: [ISO 8601 timestamp]
Discovery Source: [How the incident was detected]
Incident Commander: [Name]

TIMELINE
[Timestamp] — [Event description]
[Timestamp] — [Event description]

AFFECTED SYSTEMS
- [System/service name and scope]

CONTAINMENT ACTIONS
- [Action taken] — [Timestamp]

INVESTIGATION FINDINGS
- [Finding]

RISK ASSESSMENT (HIPAA 4-Factor)
1. Nature/extent of PHI: [Assessment]
2. Unauthorized person: [Assessment]
3. PHI acquired/viewed: [Assessment]
4. Risk mitigation: [Assessment]
Conclusion: [Reportable breach / Not a reportable breach]

NOTIFICATIONS SENT
- [Recipient] — [Date/Time] — [Method]

REMEDIATION
- [Action] — [Owner] — [Status]

POST-INCIDENT REVIEW
- Date: [Date]
- Root Cause: [Description]
- Process Improvements: [List]
```

---

## 9. Training and Testing

### Training Requirements

- **Onboarding:** All personnel with system access must review this plan within 30 days of joining
- **Annual refresher:** Review updated plan and discuss any incidents from the past year
- **Role-specific:** Personnel assigned incident response roles must understand their specific responsibilities

### Testing Requirements

- **Annual tabletop exercise:** Walk through a simulated SEV-1 scenario (e.g., "Database credentials exposed in a public repository") to validate the plan's effectiveness and identify gaps
- **Post-incident:** After any real SEV-1 or SEV-2 incident, conduct a post-incident review that evaluates plan effectiveness

### Documentation

- Maintain records of all training sessions and tabletop exercises
- Retain training records for 6 years (per HIPAA documentation retention requirements)

---

## 10. Regulatory References

| Reference | Description |
|-----------|-------------|
| **45 CFR § 164.308(a)(6)** | Security incident procedures — requires policies and procedures to address security incidents |
| **45 CFR § 164.312(b)** | Audit controls — mechanisms to record and examine activity in systems containing PHI |
| **45 CFR § 164.312(c)(1)** | Integrity controls — protect PHI from improper alteration or destruction |
| **45 CFR §§ 164.400–414** | HIPAA Breach Notification Rule — notification requirements for breaches of unsecured PHI |
| **45 CFR § 164.402** | Breach definition and risk assessment factors |
| **45 CFR § 164.410** | Business Associate notification obligations to Covered Entities |
| **45 CFR § 164.530(j)** | Documentation retention — 6 years from creation or last effective date |
| **HITECH Act § 13402** | Breach notification requirements codified by HITECH, extending HIPAA obligations to Business Associates |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | February 2026 | Initial plan — covers pass-through PHI model |

---

**End of Document**
