/**
 * Zod schemas for structured LLM output.
 *
 * These schemas define the expected structure of PT SOAP notes and are used:
 * 1. For JSON mode with Gemini (responseJsonSchema)
 * 2. For tool use with Claude (input_schema)
 * 3. For runtime validation of parsed responses
 */

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Suggested CPT code without time data.
 * Used when clinician mentions an intervention but doesn't provide explicit times.
 * This prevents hallucination of billing times while still providing value.
 */
export const SuggestedCodeSchema = z.object({
  cptCode: z
    .string()
    .describe('CPT code (e.g., "97110", "97140", "97530")'),
  description: z
    .string()
    .describe('Service description (e.g., "Therapeutic Exercise", "Manual Therapy")'),
});

export type SuggestedCode = z.infer<typeof SuggestedCodeSchema>;

/**
 * Billing charge entry for a single CPT code with verified time data.
 * ONLY used when clinician explicitly provides time in their notes.
 */
export const BillingChargeSchema = z.object({
  cptCode: z
    .string()
    .describe('CPT code (e.g., "97110", "97140", "97530")'),
  description: z
    .string()
    .describe('Service description (e.g., "Therapeutic Exercise", "Manual Therapy")'),
  minutes: z
    .number()
    .int()
    .min(1)
    .describe('Time spent in minutes - ONLY include if clinician explicitly stated time'),
  units: z
    .number()
    .int()
    .min(1)
    .describe('Billable units based on 8-minute rule'),
});

export type BillingCharge = z.infer<typeof BillingChargeSchema>;

/**
 * Goal status tracking for short-term and long-term goals.
 *
 * Trust principle: Status can be inferred from language ("making progress" → progressing),
 * but percentComplete should ONLY be included if the clinician explicitly states a percentage.
 */
export const GoalStatusSchema = z.object({
  description: z
    .string()
    .describe('Goal description (e.g., "Knee flexion >= 110 degrees")'),
  status: z
    .enum(['not_started', 'progressing', 'met', 'discontinued'])
    .describe(
      'Current status of the goal. Can be inferred from language: ' +
      '"making progress" → progressing, "achieved" → met, "stopped" → discontinued'
    ),
  percentComplete: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe(
      'Percentage complete toward goal. ' +
      'ONLY include if clinician explicitly states a percentage (e.g., "75% toward goal"). ' +
      'NEVER estimate or hallucinate percentages - omit this field if not explicitly stated.'
    ),
});

export type GoalStatus = z.infer<typeof GoalStatusSchema>;

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
export const BillingSummarySchema = z.object({
  // Tier 1: Only when explicit times are provided by clinician
  charges: z
    .array(BillingChargeSchema)
    .optional()
    .describe(
      'Individual CPT code charges with time and units. ' +
      'ONLY include if clinician explicitly stated times (e.g., "manual therapy 15 min"). ' +
      'NEVER estimate or hallucinate times.'
    ),
  totalTimedMinutes: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Total timed service minutes - only if charges are present'),
  totalUnits: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Total billable units - only if charges are present'),

  // Tier 2: Always when interventions are mentioned (even without times)
  suggestedCodes: z
    .array(SuggestedCodeSchema)
    .optional()
    .describe(
      'Suggested CPT codes based on interventions mentioned (without times). ' +
      'Include when therapist mentions interventions but does not specify times. ' +
      'Helps clinician identify correct codes to bill without fabricating time data.'
    ),

  suggestedModifiers: z
    .array(z.string())
    .optional()
    .describe('Suggested modifiers (e.g., "GP" for Medicare, "59" for distinct procedures, "KX" for medical necessity)'),
});

export type BillingSummary = z.infer<typeof BillingSummarySchema>;

/**
 * Goals tracking section for progress notes.
 */
export const GoalsTrackingSchema = z.object({
  shortTerm: z
    .array(GoalStatusSchema)
    .optional()
    .describe('Short-term goals (typically 2-4 weeks)'),
  longTerm: z
    .array(GoalStatusSchema)
    .optional()
    .describe('Long-term goals (typically discharge goals)'),
});

export type GoalsTracking = z.infer<typeof GoalsTrackingSchema>;

/**
 * Full PT note output schema with SOAP sections, billing, goals, and alerts.
 *
 * This is the complete structured output from the LLM that powers the extension UI.
 */
export const PTNoteOutputSchema = z.object({
  // Core SOAP narrative sections
  subjective: z
    .string()
    .describe(
      'Patient-reported symptoms, pain levels (0-10), functional limitations, ' +
      'home exercise program compliance, and changes since last visit'
    ),
  objective: z
    .string()
    .describe(
      'Measurable clinical findings (ROM in degrees, strength MMT grades, special tests, ' +
      'gait analysis) AND interventions performed with time, technique, and skilled language ' +
      'that supports medical necessity'
    ),
  assessment: z
    .string()
    .describe(
      'Clinical interpretation of findings, progress toward established goals, ' +
      'treatment effectiveness, barriers to progress, and justification for skilled care'
    ),
  plan: z
    .string()
    .describe(
      'Treatment plan for next visit, frequency/duration recommendations, ' +
      'home exercise program updates, patient education, and short-term goals'
    ),

  // Structured billing reference (displayed separately, not pasted into EMR billing)
  billing: BillingSummarySchema.optional().describe(
    'Billing summary for reference. Note: EMRs use structured entry (checkboxes/dropdowns) ' +
    'for billing, not text fields. This is for visual reference while clicking checkboxes.'
  ),

  // Goals tracking (when PT mentions progress toward goals)
  goals: GoalsTrackingSchema.optional().describe(
    'Goal status tracking when progress toward goals is mentioned in the quick notes'
  ),

  // Alerts for the therapist
  alerts: z
    .array(z.string())
    .optional()
    .describe(
      'Billing warnings, documentation gaps, or modifier reminders ' +
      '(e.g., "Medicare patient? Add GP modifier", "15 min manual therapy - 16+ safer for audits")'
    ),

  // Uncertainty signals for clinician review
  uncertainAreas: z
    .array(z.string())
    .optional()
    .describe(
      'Areas where the clinician input was ambiguous and the model made an interpretation choice. ' +
      'Examples: "Interpreted \'ther ex\' as \'therapeutic exercise\' (not therapy extension)", ' +
      '"ROM mentioned without specifying joint - used general language", ' +
      '"Unclear if \'15 min\' applies to manual therapy or total session". ' +
      'Flag these for clinician review. Only include genuinely ambiguous items. ' +
      'Do NOT flag routine shorthand expansion (e.g., "HEP" to "home exercise program").'
    ),
});

export type PTNoteOutput = z.infer<typeof PTNoteOutputSchema>;

/**
 * Clinical settings that affect documentation priorities.
 * Different settings have unique requirements (e.g., homebound justification for home health).
 */
export type ClinicalSetting =
  | 'outpatient' // Default - private practice, ortho clinic
  | 'post_surgical' // Protocol-driven, precautions
  | 'home_health' // Homebound status required
  | 'snf' // Skilled nursing facility
  | 'acute_care' // Hospital - brief, focused
  | 'pediatric'; // Developmental focus

/**
 * Convert PTNoteOutputSchema to JSON Schema for LLM APIs.
 *
 * @returns JSON Schema object suitable for:
 *   - Gemini: generationConfig.responseJsonSchema
 *   - Claude: tools[].input_schema
 */
export function getPTNoteJsonSchema(): Record<string, unknown> {
  return zodToJsonSchema(PTNoteOutputSchema, {
    // Don't add $schema and definitions wrapper
    // LLMs expect a simple schema object
    $refStrategy: 'none',
  });
}

/**
 * Validate a parsed response against the PTNoteOutputSchema.
 *
 * @param data - Parsed JSON from LLM response
 * @returns Validated PTNoteOutput
 * @throws ZodError if validation fails
 */
export function validatePTNoteOutput(data: unknown): PTNoteOutput {
  return PTNoteOutputSchema.parse(data);
}

/**
 * Safely validate a parsed response, returning null on failure.
 *
 * @param data - Parsed JSON from LLM response
 * @returns Validated PTNoteOutput or null if invalid
 */
export function safeParsePTNoteOutput(data: unknown): PTNoteOutput | null {
  const result = PTNoteOutputSchema.safeParse(data);
  return result.success ? result.data : null;
}
