import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
import { generateRateLimit } from '../middleware/rate-limit.js';
import { aiService } from '../services/ai-service.js';
import { auditService } from '../services/audit-service.js';
import { usageService } from '../services/usage-service.js';
import { AuditAction, type AuthenticatedRequest, type NoteType } from '../types/index.js';

export const notesRouter = Router();

// All notes routes require authentication and active subscription
notesRouter.use(requireAuth);
notesRouter.use(requireActiveSubscription);
notesRouter.use(generateRateLimit);

// Validation schema
const generateNoteSchema = z.object({
  noteType: z.enum(['daily_note', 'initial_eval', 'progress_note', 'discharge']),
  patientContext: z.string().max(500).optional(),
  quickNotes: z.string().min(10, 'Please provide more detail').max(5000),
});

// POST /notes/generate
notesRouter.post('/generate', async (req, res, next) => {
  try {
    const { noteType, patientContext, quickNotes } = generateNoteSchema.parse(req.body);
    const { userId } = (req as AuthenticatedRequest).user;
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');

    const result = await aiService.generateSOAPNote(
      quickNotes,
      noteType as NoteType,
      patientContext
    );

    // Log audit (without PHI) - HIPAA compliant
    await auditService.log({
      userId,
      action: AuditAction.NOTE_GENERATED,
      status: 'SUCCESS',
      metadata: {
        noteType,
        tokensUsed: result.metadata.tokensUsed,
        generationTimeMs: result.metadata.generationTimeMs,
      },
      ipAddress,
      userAgent,
    });

    // Update usage tracking
    await usageService.incrementUsage(userId, result.metadata.tokensUsed);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // HIPAA: Log failed generation attempts (without PHI)
    const { userId } = (req as AuthenticatedRequest).user;
    const ipAddress = req.ip ?? undefined;
    const userAgent = req.get('user-agent');
    const noteType = req.body?.noteType;

    await auditService.log({
      userId,
      action: AuditAction.NOTE_GENERATED,
      status: 'FAILURE',
      metadata: {
        noteType: noteType || 'unknown',
        // Sanitize error - don't include message as it may contain user input
        errorType: error instanceof z.ZodError ? 'validation_error' : 'generation_error',
      },
      ipAddress,
      userAgent,
    });

    next(error);
  }
});
