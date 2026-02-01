import { describe, it, expect } from 'vitest';
import {
  PTNoteOutputSchema,
  BillingChargeSchema,
  GoalStatusSchema,
  getPTNoteJsonSchema,
  validatePTNoteOutput,
  safeParsePTNoteOutput,
} from './schemas.js';

describe('LLM Schemas', () => {
  describe('BillingChargeSchema', () => {
    it('should validate a valid billing charge', () => {
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

  describe('GoalStatusSchema', () => {
    it('should validate a goal with all fields', () => {
      const goal = {
        description: 'Knee flexion >= 110 degrees',
        status: 'progressing' as const,
        percentComplete: 75,
      };

      const result = GoalStatusSchema.parse(goal);
      expect(result).toEqual(goal);
    });

    it('should validate a goal without percentComplete', () => {
      const goal = {
        description: 'Return to running',
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

    it('should validate a note with billing information', () => {
      const noteWithBilling = {
        ...validNote,
        billing: {
          charges: [
            { cptCode: '97110', description: 'Therapeutic Exercise', minutes: 23, units: 2 },
            { cptCode: '97140', description: 'Manual Therapy', minutes: 15, units: 1 },
          ],
          totalTimedMinutes: 38,
          totalUnits: 3,
          suggestedModifiers: ['GP'],
        },
      };

      const result = PTNoteOutputSchema.parse(noteWithBilling);
      expect(result.billing).toBeDefined();
      expect(result.billing!.charges).toHaveLength(2);
      expect(result.billing!.totalUnits).toBe(3);
      expect(result.billing!.suggestedModifiers).toEqual(['GP']);
    });

    it('should validate a note with goal tracking', () => {
      const noteWithGoals = {
        ...validNote,
        goals: {
          shortTerm: [
            { description: 'Knee flexion >= 110 degrees', status: 'met' as const, percentComplete: 100 },
          ],
          longTerm: [
            { description: 'Return to running', status: 'progressing' as const, percentComplete: 50 },
          ],
        },
      };

      const result = PTNoteOutputSchema.parse(noteWithGoals);
      expect(result.goals).toBeDefined();
      expect(result.goals!.shortTerm).toHaveLength(1);
      expect(result.goals!.shortTerm![0]!.status).toBe('met');
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
