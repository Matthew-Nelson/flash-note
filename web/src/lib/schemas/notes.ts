import { z } from 'zod';

export const generateNoteSchema = z.object({
  noteType: z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge']),
  patientContext: z.string().trim().max(500).optional(),
  quickNotes: z.string().trim().min(10, 'Please provide more detail').max(5000),
});

export type GenerateNoteInput = z.infer<typeof generateNoteSchema>;
