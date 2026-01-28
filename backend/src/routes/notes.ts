import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requireActiveSubscription } from '../middleware/subscription.js';
import { generateRateLimit } from '../middleware/rate-limit.js';
import { aiService } from '../services/ai-service.js';
import { auditService } from '../services/audit-service.js';
import { usageService } from '../services/usage-service.js';
import { AuditAction, type AuthenticatedRequest, type NoteType } from '../types/index.js';
import { getRequestMetadata, safeAuditLog } from '../utils/request-utils.js';

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
  const { ipAddress, userAgent } = getRequestMetadata(req);
  const user = (req as AuthenticatedRequest).user;
  const userId = user?.userId;

  try {
    const { noteType, patientContext, quickNotes } = generateNoteSchema.parse(req.body);

    const result = await aiService.generateSOAPNote(
      quickNotes,
      noteType as NoteType,
      patientContext
    );

    // Log audit (without PHI) - HIPAA compliant
    safeAuditLog(
      auditService.log({
        userId: userId ?? null,
        action: AuditAction.NOTE_GENERATED,
        status: 'SUCCESS',
        metadata: {
          noteType,
          tokensUsed: result.metadata.tokensUsed,
          generationTimeMs: result.metadata.generationTimeMs,
        },
        ipAddress,
        userAgent,
      }),
      'notes:generate_success'
    );

    // Update usage tracking
    if (userId) {
      await usageService.incrementUsage(userId, result.metadata.tokensUsed);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    // HIPAA: Log failed generation attempts (without PHI)
    const noteType = req.body?.noteType;

    safeAuditLog(
      auditService.log({
        userId: userId ?? null,
        action: AuditAction.NOTE_GENERATED,
        status: 'FAILURE',
        metadata: {
          noteType: noteType || 'unknown',
          // Sanitize error - don't include message as it may contain user input
          errorType: error instanceof z.ZodError ? 'validation_error' : 'generation_error',
        },
        ipAddress,
        userAgent,
      }),
      'notes:generate_failure'
    );

    next(error);
  }
});
