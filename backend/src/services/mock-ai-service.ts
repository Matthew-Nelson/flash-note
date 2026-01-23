import type { GeneratedNote, NoteType } from '../types/index.js';

/**
 * Mock SOAP note responses for local development.
 * These are realistic PT SOAP notes to test the UI without hitting the LLM API.
 */

const MOCK_RESPONSES: Record<NoteType, Omit<GeneratedNote, 'metadata'>> = {
  daily_note: {
    subjective:
      'Patient reports pain level of 4/10 at rest, increasing to 6/10 with prolonged standing. States compliance with home exercise program (HEP) at 80%, performing exercises 5 days per week. Reports improved ability to walk to mailbox without stopping. Continues to have difficulty with stair climbing, particularly descending.',
    objective:
      'Lumbar AROM: Flexion 60° (prev 50°), Extension 15° (prev 10°), SB L/R 20°/25°. SLR: R 70° (prev 60°), L 80°. Hip strength: R hip abductors 4/5 (prev 3+/5), L hip abductors 4+/5. Gait: Decreased lateral trunk sway noted, improved cadence. Tender to palpation L4-L5 paraspinals, decreased from previous. Performed: Manual therapy to lumbar spine 8 min, therapeutic exercises including bridges 3x10, clamshells 3x12 bilateral, prone press-ups 2x10, gait training 10 min.',
    assessment:
      'Patient demonstrates continued progress toward functional goals. Improved lumbar ROM and hip strength correlate with reported functional improvements. Pain levels remain elevated with activity but trending downward. Patient motivated and compliant with plan of care.',
    plan:
      'Continue PT 2x/week for 3 weeks. Progress hip strengthening to standing exercises. Add single leg balance activities. Update HEP to include standing hip abduction and tandem stance holds. Short-term goal: Ascend/descend 12 stairs with rail in 45 seconds within 2 weeks.',
  },

  initial_eval: {
    subjective:
      'Patient is a 52-year-old female referred for PT evaluation following gradual onset of right shoulder pain over 3 months. Reports pain level 5/10 at rest, 8/10 with overhead activities. Primary complaints include difficulty reaching overhead, sleeping on right side, and fastening bra. Denies numbness/tingling in upper extremity. No prior shoulder injuries or surgeries. Works as administrative assistant, reports increased symptoms with computer use. Goals: Return to pain-free overhead reaching, sleep comfortably on right side.',
    objective:
      'Posture: Forward head, rounded shoulders bilateral, R shoulder slightly elevated. Cervical ROM: WNL all planes. R Shoulder AROM: Flexion 140° (L 170°), Abduction 130° (L 175°), ER 45° (L 70°), IR 40° (L 70°). PROM: Flexion 160°, Abduction 150°, ER 55°, IR 50° with end-range pain. Strength: R shoulder flexion 4-/5, abduction 3+/5, ER 4/5, IR 4/5. Special tests: Neer (+), Hawkins-Kennedy (+), Empty can (+), painful arc 70-120°. Negative apprehension, negative drop arm. Palpation: Tender supraspinatus insertion, bicipital groove.',
    assessment:
      'Clinical presentation consistent with right shoulder impingement syndrome with possible rotator cuff tendinopathy. Significant ROM and strength deficits noted. Postural dysfunction likely contributing factor. Good rehab potential given gradual onset, no trauma history, and patient motivation.',
    plan:
      'Initiate PT 2x/week for 6 weeks. Focus on rotator cuff strengthening, scapular stabilization, postural correction, and manual therapy for soft tissue mobility. Initial treatment: Posterior capsule stretching, AAROM exercises, isometric rotator cuff, ice. HEP: Pendulums, towel IR stretch, scapular retractions. Long-term goal: Return to pain-free overhead reaching within 6 weeks. Short-term goal: Reduce pain to 3/10 with ADLs within 2 weeks.',
  },

  progress_note: {
    subjective:
      'Patient reports overall 50% improvement since initial evaluation 3 weeks ago. Current pain 3/10 at rest (was 5/10), 5/10 with activity (was 8/10). Now able to sleep on right side for short periods. Reaching overhead still limited but improving. Compliance with HEP 100% per patient report. Returned to modified work duties, avoiding repetitive overhead tasks.',
    objective:
      'R Shoulder AROM: Flexion 160° (init 140°), Abduction 155° (init 130°), ER 60° (init 45°), IR 55° (init 40°). Strength: R shoulder flexion 4/5 (init 4-/5), abduction 4/5 (init 3+/5), ER 4+/5 (init 4/5). Neer and Hawkins-Kennedy mildly positive (prev strongly positive). Painful arc narrowed to 90-110° (prev 70-120°). Posture improved with decreased forward head position. Treatment: IASTM to rotator cuff 6 min, joint mobilizations grade III-IV glenohumeral, therapeutic exercises progressed to resistance band ER/IR, prone Y-T-W, wall slides.',
    assessment:
      'Patient making excellent progress toward established goals. ROM gains of 15-20% in all planes. Strength improved 1/2 to full grade. Impingement signs decreasing. On track to meet discharge goals. Recommend continuation of current frequency.',
    plan:
      'Continue PT 2x/week for 3 more weeks. Progress strengthening to higher resistance and incorporate functional reaching patterns. Begin return-to-work simulation exercises. Update HEP with resistance band exercises. Short-term goal: AROM flexion 170° within 2 weeks. Long-term goal: Return to full work duties without restrictions.',
  },

  discharge: {
    subjective:
      'Final visit. Patient reports 90% overall improvement since initial evaluation. Pain 0-1/10 at rest, 2/10 with heavy overhead lifting. Has returned to full work duties without restrictions for past 2 weeks with no symptom exacerbation. Sleeping on right side without difficulty. Able to perform all ADLs including overhead reaching, dressing, and hair washing without pain. Very satisfied with outcomes.',
    objective:
      'R Shoulder AROM: Flexion 175° (init 140°, goal 170°), Abduction 175° (init 130°, goal 170°), ER 70° (init 45°, goal 65°), IR 65° (init 40°, goal 60°). All ROMs now WFL. Strength: All shoulder girdle musculature 5/5 (init 3+-4/5). Neer (-), Hawkins-Kennedy (-). No painful arc. Posture: Normalized, maintains scapular retraction with activities. Functional testing: Able to reach overhead repeatedly x20 without pain, able to carry 10lb bag overhead.',
    assessment:
      'All short-term and long-term goals achieved. Patient demonstrates full resolution of shoulder impingement symptoms. ROM and strength normalized. Functional goals met. Patient independent with HEP and demonstrates good understanding of activity modification and injury prevention strategies. Discharge criteria met.',
    plan:
      'Discharge from skilled PT services. Continue independent HEP 3x/week for maintenance: resistance band ER/IR, prone Y-T-W, wall slides, pec stretching. Ergonomic recommendations for workstation reviewed. Patient to return to PT PRN if symptoms recur. Follow up with physician as scheduled. Total visits: 12 over 6 weeks.',
  },
};

/**
 * Simulates a delay to mimic real API latency
 */
function simulateLatency(): Promise<void> {
  const delay = 500 + Math.random() * 1000; // 500-1500ms
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Generates a mock SOAP note response for local development.
 * Returns realistic PT documentation without calling the LLM API.
 */
export async function generateMockSOAPNote(
  quickNotes: string,
  noteType: NoteType,
  _patientContext?: string
): Promise<GeneratedNote> {
  const startTime = Date.now();

  // Simulate network latency
  await simulateLatency();

  const mockResponse = MOCK_RESPONSES[noteType];
  const generationTimeMs = Date.now() - startTime;

  // Calculate approximate token count based on content length
  const totalChars =
    quickNotes.length +
    mockResponse.subjective.length +
    mockResponse.objective.length +
    mockResponse.assessment.length +
    mockResponse.plan.length;
  const estimatedTokens = Math.ceil(totalChars / 4); // ~4 chars per token

  console.log(`[MockAI] Generated mock ${noteType} (${generationTimeMs}ms)`);

  return {
    ...mockResponse,
    metadata: {
      model: 'mock-gemini-2.5-flash',
      tokensUsed: estimatedTokens,
      generationTimeMs,
    },
  };
}
