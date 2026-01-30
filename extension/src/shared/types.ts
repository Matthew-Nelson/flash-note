export type NoteType = 'daily_note' | 'initial_eval' | 'progress_note' | 'discharge';

export interface User {
  id: string;
  email: string;
  subscriptionStatus: string;
  trialEndsAt: string;
}

export interface GeneratedNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  metadata?: {
    generationTimeMs: number;
  };
}

export interface GenerateNoteInput {
  noteType: NoteType;
  patientContext?: string;
  quickNotes: string;
}
