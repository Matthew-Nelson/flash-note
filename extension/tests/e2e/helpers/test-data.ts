/**
 * Test data helpers for E2E tests.
 *
 * Contains sample data that matches what a real PT would enter.
 * These are NOT PHI - they're fictional examples for testing.
 */

/**
 * Sample session notes for different note types.
 * These simulate realistic PT shorthand input.
 */
export const sampleSessionNotes = {
  dailyNote: `pt reports 40% pain reduction since last visit
flex ROM improved 50 to 65 deg
ext ROM 0-10 deg (was 0-5)
performed MFR lumbar paraspinals 10 min
grade III PA mobs L4-5 x 3 min
neuromuscular re-ed for core stabilization
updated HEP: bridges 2x15, bird dogs 2x10, cat cow 1x10
pt tolerated well, no adverse reactions`,

  initialEval: `new pt eval - 52yo male referred by Dr. Smith for chronic LBP
onset 6 months ago, insidious, no trauma
pain 7/10 constant ache, worse with prolonged sitting
work: desk job 8hrs/day
PMH: HTN controlled, no surgical hx
flex ROM 40 deg with pain
ext ROM 5 deg limited by pain
SLR neg bilat
neuro intact L1-S1
posture: forward head, increased lumbar lordosis
goals: reduce pain to 3/10, return to golf
plan: 2x/wk x 6 weeks, manual therapy, core stabilization`,

  progressNote: `week 4 of 8 - mid-program progress assessment
STG 1: pain 7->4/10 MET
STG 2: flex ROM 40->55 deg PROGRESSING
STG 3: sitting tolerance 20->45 min MET
LTG 1: return to golf NOT MET (50% progress)
interventions effective, pt compliant with HEP
recommend continue current POC
next eval in 4 weeks`,

  discharge: `completed 8 week program - all goals met
pain reduced 7/10 to 1/10 at rest
flex ROM 40->70 deg (WNL)
ext ROM 5->15 deg (WNL)
sitting tolerance now 2+ hours
returned to golf without limitations
independent with HEP
no further skilled PT needed
recommend: continue HEP, annual checkup PRN`,
};

/**
 * Sample patient context entries.
 * Brief identifiers without actual PHI.
 */
export const samplePatientContext = {
  chronicLBP: 'John, 52M, chronic LBP, visit 5/12',
  acuteNeck: 'Sarah, 34F, acute neck pain post MVA, visit 2/8',
  postOp: 'Mike, 67M, s/p TKR 3 weeks ago, visit 6/12',
  athlete: 'Emma, 22F, D1 soccer, ACL reconstruction, visit 10/16',
  geriatric: 'Dorothy, 78F, fall risk, balance training, visit 4/8',
};

/**
 * Invalid input examples for validation testing.
 */
export const invalidInputs = {
  tooShort: 'hi',
  emptySpaces: '          ',
  justNumbers: '12345',
  specialCharsOnly: '!@#$%^&*()',
};

/**
 * Generate a random email for registration tests.
 * Uses timestamp to ensure uniqueness.
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `test-${timestamp}-${random}@example.com`;
}

/**
 * Generate a valid test password that meets requirements.
 */
export function generateTestPassword(): string {
  return `TestPass${Date.now().toString().slice(-4)}!`;
}
