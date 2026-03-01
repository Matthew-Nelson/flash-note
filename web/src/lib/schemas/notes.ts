import { z } from 'zod';

export const generateNoteSchema = z.object({
  noteType: z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge']),
  patientContext: z.string().max(500).optional(),
  quickNotes: z.string().min(10, 'Please provide more detail').max(5000),
});

export type GenerateNoteInput = z.infer<typeof generateNoteSchema>;
