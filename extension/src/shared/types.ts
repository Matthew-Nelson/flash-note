export type NoteType = 'daily_note' | 'initial_eval' | 'progress_note' | 'discharge';

export interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt: string;
}

/**
 * Suggested CPT code without time data.
 * Used when clinician mentions an intervention but doesn't provide explicit times.
 * This prevents hallucination of billing times while still providing value.
 */
export interface SuggestedCode {
  cptCode: string;
  description: string;
}

/**
 * Billing charge entry for a single CPT code with verified time data.
 * ONLY used when clinician explicitly provides time in their notes.
 */
export interface BillingCharge {
  cptCode: string;
  description: string;
  minutes: number;
  units: number;
}

/**
 * Billing summary with two-tier output:
 *
 * Tier 1 (charges): ONLY populated when clinician provides explicit times
 *   - Full CPT codes with minutes and units
 *   - Calculated totals
 *
 * Tier 2 (suggestedCodes): ALWAYS populated when interventions are mentioned
 *   - CPT code and description only
 *   - NO time or unit data (prevents hallucination)
 *
 * This approach builds clinician trust by never fabricating billing times.
 */
export interface BillingSummary {
  // Tier 1: Only when explicit times are provided by clinician
  charges?: BillingCharge[];
  totalTimedMinutes?: number;
  totalUnits?: number;

  // Tier 2: Always when interventions are mentioned (even without times)
  suggestedCodes?: SuggestedCode[];

  suggestedModifiers?: string[];
}

/**
 * Goal status tracking for short-term and long-term goals.
 *
 * Trust principle: Status can be inferred from language ("making progress" → progressing),
 * but percentComplete is ONLY included if the clinician explicitly states a percentage.
 */
export interface GoalStatus {
  description: string;
  /** Can be inferred from language in clinician notes */
  status: 'not_started' | 'progressing' | 'met' | 'discontinued';
  /** ONLY present if clinician explicitly stated a percentage (e.g., "75% toward goal") */
  percentComplete?: number;
}

/**
 * Goals tracking section for progress notes.
 */
export interface GoalsTracking {
  shortTerm?: GoalStatus[];
  longTerm?: GoalStatus[];
}

export interface GeneratedNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  billing?: BillingSummary;
  goals?: GoalsTracking;
  alerts?: string[];
  metadata?: {
    generationTimeMs: number;
  };
}

export interface GenerateNoteInput {
  noteType: NoteType;
  patientContext?: string;
  quickNotes: string;
}
