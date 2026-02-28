import { describe, it, expect } from 'vitest';
import {
  PTNoteOutputSchema,
  BillingChargeSchema,
  SuggestedCodeSchema,
  BillingSummarySchema,
  GoalStatusSchema,
  getPTNoteJsonSchema,
  validatePTNoteOutput,
  safeParsePTNoteOutput,
} from './schemas';

describe('LLM Schemas', () => {
  describe('SuggestedCodeSchema', () => {
    it('should validate a suggested code (Tier 2 - no times)', () => {
      const code = {
        cptCode: '97110',
        description: 'Therapeutic Exercise',
      };

      const result = SuggestedCodeSchema.parse(code);
      expect(result).toEqual(code);
    });

    it('should reject missing cptCode', () => {
      const code = {
        description: 'Therapeutic Exercise',
      };

      expect(() => SuggestedCodeSchema.parse(code)).toThrow();
    });

    it('should reject missing description', () => {
      const code = {
        cptCode: '97110',
      };

      expect(() => SuggestedCodeSchema.parse(code)).toThrow();
    });
  });

  describe('BillingChargeSchema', () => {
    it('should validate a valid billing charge (Tier 1 - with times)', () => {
      const charge = {
        cptCode: '97110',
        description: 'Therapeutic Exercise',
        minutes: 23,
        units: 2,
      };

      const result = BillingChargeSchema.parse(charge);
      expect(result).toEqual(charge);
    });

    it('should reject negative minutes', () => {
      const charge = {
        cptCode: '97110',
        description: 'Therapeutic Exercise',
        minutes: -5,
        units: 1,
      };

      expect(() => BillingChargeSchema.parse(charge)).toThrow();
    });

    it('should reject zero units', () => {
      const charge = {
        cptCode: '97110',
        description: 'Therapeutic Exercise',
        minutes: 10,
        units: 0,
      };

      expect(() => BillingChargeSchema.parse(charge)).toThrow();
    });
  });

  describe('BillingSummarySchema - Two-Tier Billing', () => {
    it('should validate Tier 1 + Tier 2 billing (full charges with suggested codes)', () => {
      const billing = {
        charges: [
          { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 23, units: 2 },
          { cptCode: '97140', description: 'Manual Therapy', minutes: 15, units: 1 },
        ],
        totalTimedMinutes: 38,
        totalUnits: 3,
        suggestedCodes: [
          { cptCode: '97110', description: 'Therapeutic Exercise' },
          { cptCode: '97140', description: 'Manual Therapy' },
        ],
        suggestedModifiers: ['GP'],
      };

      const result = BillingSummarySchema.parse(billing);
      expect(result.charges).toHaveLength(2);
      expect(result.suggestedCodes).toHaveLength(2);
      expect(result.totalUnits).toBe(3);
    });

    it('should validate Tier 2 only billing (suggested codes without times)', () => {
      // This is the key safety feature - when clinician doesn't provide times
      const billing = {
        suggestedCodes: [
          { cptCode: '97110', description: 'Therapeutic Exercise' },
          { cptCode: '97140', description: 'Manual Therapy' },
        ],
        suggestedModifiers: ['GP'],
      };

      const result = BillingSummarySchema.parse(billing);
      expect(result.charges).toBeUndefined();
      expect(result.totalTimedMinutes).toBeUndefined();
      expect(result.totalUnits).toBeUndefined();
      expect(result.suggestedCodes).toHaveLength(2);
    });

    it('should validate partial Tier 1 (some interventions have times, others do not)', () => {
      // Clinician provided time for one intervention but not the other
      const billing = {
        charges: [
          { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 23, units: 2 },
        ],
        totalTimedMinutes: 23,
        totalUnits: 2,
        suggestedCodes: [
          { cptCode: '97110', description: 'Therapeutic Exercise' },
          { cptCode: '97140', description: 'Manual Therapy' }, // No time provided for this one
        ],
      };

      const result = BillingSummarySchema.parse(billing);
      expect(result.charges).toHaveLength(1);
      expect(result.suggestedCodes).toHaveLength(2);
    });

    it('should validate empty billing summary', () => {
      // Edge case: no interventions mentioned at all
      const billing = {};

      const result = BillingSummarySchema.parse(billing);
      expect(result.charges).toBeUndefined();
      expect(result.suggestedCodes).toBeUndefined();
    });
  });

  describe('GoalStatusSchema - Trust-Based Output', () => {
    it('should validate a goal with explicit percentComplete (clinician stated percentage)', () => {
      // Clinician said "about 75% toward goal"
      const goal = {
        description: 'Knee flexion >= 110 degrees',
        status: 'progressing' as const,
        percentComplete: 75,
      };

      const result = GoalStatusSchema.parse(goal);
      expect(result).toEqual(goal);
    });

    it('should validate a goal without percentComplete (clinician did not state percentage)', () => {
      // Clinician just said "making progress" - no percentage stated
      // percentComplete should be omitted, NOT hallucinated
      const goal = {
        description: 'Return to running',
        status: 'progressing' as const,
      };

      const result = GoalStatusSchema.parse(goal);
      expect(result.percentComplete).toBeUndefined();
    });

    it('should validate a "met" goal with 100% (implied by achievement)', () => {
      // When a goal is met, 100% is implied and can be included
      const goal = {
        description: 'Reduce pain to <= 3/10',
        status: 'met' as const,
        percentComplete: 100,
      };

      const result = GoalStatusSchema.parse(goal);
      expect(result.percentComplete).toBe(100);
    });

    it('should validate a "met" goal without percentComplete', () => {
      // Even for met goals, percentComplete is optional
      const goal = {
        description: 'Reduce pain to <= 3/10',
        status: 'met' as const,
      };

      const result = GoalStatusSchema.parse(goal);
      expect(result.percentComplete).toBeUndefined();
    });

    it('should validate a "not_started" goal without percentComplete', () => {
      const goal = {
        description: 'Return to overhead reaching',
        status: 'not_started' as const,
      };

      const result = GoalStatusSchema.parse(goal);
      expect(result.percentComplete).toBeUndefined();
    });

    it('should reject invalid status', () => {
      const goal = {
        description: 'Some goal',
        status: 'invalid_status',
      };

      expect(() => GoalStatusSchema.parse(goal)).toThrow();
    });

    it('should reject percentComplete over 100', () => {
      const goal = {
        description: 'Some goal',
        status: 'progressing' as const,
        percentComplete: 150,
      };

      expect(() => GoalStatusSchema.parse(goal)).toThrow();
    });

    it('should reject negative percentComplete', () => {
      const goal = {
        description: 'Some goal',
        status: 'progressing' as const,
        percentComplete: -10,
      };

      expect(() => GoalStatusSchema.parse(goal)).toThrow();
    });
  });

  describe('PTNoteOutputSchema', () => {
    const validNote = {
      subjective: 'Patient reports pain 4/10, improved from 6/10 last visit.',
      objective:
        'ROM: Knee flexion 110 degrees. Strength: Quad 4/5. Interventions: Therapeutic exercise (23 min).',
      assessment: 'Good progress toward goals. Knee flexion improving.',
      plan: 'Continue PT 2x/week. Progress HEP.',
    };

    it('should validate a minimal note with only SOAP sections', () => {
      const result = PTNoteOutputSchema.parse(validNote);
      expect(result.subjective).toBe(validNote.subjective);
      expect(result.objective).toBe(validNote.objective);
      expect(result.assessment).toBe(validNote.assessment);
      expect(result.plan).toBe(validNote.plan);
      expect(result.billing).toBeUndefined();
      expect(result.goals).toBeUndefined();
      expect(result.alerts).toBeUndefined();
    });

    it('should validate a note with full billing (Tier 1 + Tier 2)', () => {
      const noteWithBilling = {
        ...validNote,
        billing: {
          charges: [
            { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 23, units: 2 },
            { cptCode: '97140', description: 'Manual Therapy', minutes: 15, units: 1 },
          ],
          totalTimedMinutes: 38,
          totalUnits: 3,
          suggestedCodes: [
            { cptCode: '97110', description: 'Therapeutic Exercise' },
            { cptCode: '97140', description: 'Manual Therapy' },
          ],
          suggestedModifiers: ['GP'],
        },
      };

      const result = PTNoteOutputSchema.parse(noteWithBilling);
      expect(result.billing).toBeDefined();
      expect(result.billing!.charges).toHaveLength(2);
      expect(result.billing!.totalUnits).toBe(3);
      expect(result.billing!.suggestedCodes).toHaveLength(2);
      expect(result.billing!.suggestedModifiers).toEqual(['GP']);
    });

    it('should validate a note with Tier 2 only billing (no times provided)', () => {
      const noteWithSuggestedOnly = {
        ...validNote,
        billing: {
          suggestedCodes: [
            { cptCode: '97110', description: 'Therapeutic Exercise' },
            { cptCode: '97140', description: 'Manual Therapy' },
          ],
          suggestedModifiers: ['GP'],
        },
      };

      const result = PTNoteOutputSchema.parse(noteWithSuggestedOnly);
      expect(result.billing).toBeDefined();
      expect(result.billing!.charges).toBeUndefined();
      expect(result.billing!.totalTimedMinutes).toBeUndefined();
      expect(result.billing!.suggestedCodes).toHaveLength(2);
    });

    it('should validate a note with goal tracking (mixed percentComplete)', () => {
      // Realistic scenario: some goals have explicit percentages, others don't
      const noteWithGoals = {
        ...validNote,
        goals: {
          shortTerm: [
            // Clinician said "achieved pain goal" - met implies 100%
            { description: 'Reduce pain to <= 3/10', status: 'met' as const, percentComplete: 100 },
            // Clinician said "about 75% toward flexion goal"
            { description: 'Knee flexion >= 110 degrees', status: 'progressing' as const, percentComplete: 75 },
          ],
          longTerm: [
            // Clinician just said "making progress" - no percentage, so omit
            { description: 'Return to running', status: 'progressing' as const },
          ],
        },
      };

      const result = PTNoteOutputSchema.parse(noteWithGoals);
      expect(result.goals).toBeDefined();
      expect(result.goals!.shortTerm).toHaveLength(2);
      expect(result.goals!.shortTerm![0].percentComplete).toBe(100);
      expect(result.goals!.shortTerm![1].percentComplete).toBe(75);
      // Long-term goal should NOT have percentComplete
      expect(result.goals!.longTerm![0].percentComplete).toBeUndefined();
    });

    it('should validate a note with alerts', () => {
      const noteWithAlerts = {
        ...validNote,
        alerts: [
          'Medicare patient? Add GP modifier',
          'Manual therapy 15 min - 16+ would be safer for audits',
        ],
      };

      const result = PTNoteOutputSchema.parse(noteWithAlerts);
      expect(result.alerts).toHaveLength(2);
    });

    it('should validate a note with uncertainAreas', () => {
      const noteWithUncertainty = {
        ...validNote,
        uncertainAreas: [
          'Interpreted "tx" as "treatment" (not thoracic spine)',
          'Unclear if "15 min" applies to manual therapy or total session',
        ],
      };

      const result = PTNoteOutputSchema.parse(noteWithUncertainty);
      expect(result.uncertainAreas).toHaveLength(2);
    });

    it('should validate a note without uncertainAreas (field is optional)', () => {
      const result = PTNoteOutputSchema.parse(validNote);
      expect(result.uncertainAreas).toBeUndefined();
    });

    it('should validate a note with empty uncertainAreas array', () => {
      const noteWithEmptyUncertainty = {
        ...validNote,
        uncertainAreas: [],
      };

      const result = PTNoteOutputSchema.parse(noteWithEmptyUncertainty);
      expect(result.uncertainAreas).toHaveLength(0);
    });

    it('should reject note missing required SOAP sections', () => {
      const invalidNote = {
        subjective: 'Some content',
        objective: 'Some content',
        // Missing assessment and plan
      };

      expect(() => PTNoteOutputSchema.parse(invalidNote)).toThrow();
    });
  });

  describe('getPTNoteJsonSchema', () => {
    it('should return a valid JSON schema object', () => {
      const schema = getPTNoteJsonSchema();

      expect(schema).toHaveProperty('type', 'object');
      expect(schema).toHaveProperty('properties');
      expect(schema).toHaveProperty('required');
    });

    it('should include all required SOAP fields', () => {
      const schema = getPTNoteJsonSchema() as { required: string[] };

      expect(schema.required).toContain('subjective');
      expect(schema.required).toContain('objective');
      expect(schema.required).toContain('assessment');
      expect(schema.required).toContain('plan');
    });

    it('should include uncertainAreas in schema properties', () => {
      const schema = getPTNoteJsonSchema() as { properties: Record<string, unknown> };
      expect(schema.properties).toHaveProperty('uncertainAreas');
    });

    it('should produce a schema usable by LLM providers', () => {
      const schema = getPTNoteJsonSchema();

      // Should be a simple object schema, not wrapped in definitions
      expect(schema.type).toBe('object');
      expect(schema).toHaveProperty('properties');
      // Should not use $ref which would require definitions
      expect(schema).not.toHaveProperty('$ref');
    });
  });

  describe('validatePTNoteOutput', () => {
    it('should return validated data for valid input', () => {
      const input = {
        subjective: 'Test subjective',
        objective: 'Test objective',
        assessment: 'Test assessment',
        plan: 'Test plan',
      };

      const result = validatePTNoteOutput(input);
      expect(result).toEqual(input);
    });

    it('should throw for invalid input', () => {
      const input = { invalid: 'data' };

      expect(() => validatePTNoteOutput(input)).toThrow();
    });
  });

  describe('safeParsePTNoteOutput', () => {
    it('should return data for valid input', () => {
      const input = {
        subjective: 'Test subjective',
        objective: 'Test objective',
        assessment: 'Test assessment',
        plan: 'Test plan',
      };

      const result = safeParsePTNoteOutput(input);
      expect(result).toEqual(input);
    });

    it('should return null for invalid input', () => {
      const input = { invalid: 'data' };

      const result = safeParsePTNoteOutput(input);
      expect(result).toBeNull();
    });
  });
});
