import { z } from 'zod';

export const generateNoteSchema = z.object({
  noteType: z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge']),
  modality: z.enum(['in_person', 'telehealth']).optional(),
  duration: z.coerce.number().int().min(1).max(480).optional(),
  patientContext: z.string().trim().max(500).optional(),
  quickNotes: z.string().trim().min(10, 'Please provide more detail').max(5000),
});

export type GenerateNoteInput = z.infer<typeof generateNoteSchema>;
export type Modality = z.infer<typeof generateNoteSchema>['modality'];
