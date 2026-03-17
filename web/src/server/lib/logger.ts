import 'server-only';

import pino from 'pino';
import { createGcpLoggingPinoConfig } from '@google-cloud/pino-logging-gcp-config';

/**
 * PHI field paths for Pino redaction.
 *
 * Defense-in-depth: The primary defense is never passing PHI to the logger.
 * This redaction catches accidental PHI leakage at the logging layer.
 * Pino uses fast-redact (~2% overhead) for path-based censoring.
 */
const PHI_REDACT_PATHS = [
  'patient',
  'patientName',
  'patientData',
  'patientContext',
  'diagnosis',
  'treatment',
  'noteContent',
  'soapNote',
  'quickNotes',
  'shorthand',
  'dateOfBirth',
  'medicalRecordNumber',
  'req.body',
  'res.body',
];

// Read NODE_ENV directly -- not from config.ts to avoid circular dependency.
// config.ts runs console.error + process.exit on validation failure (before
// the logger is available), and importing config.ts from here would create
// a circular init path. See Research Pitfall 1.
const isProduction = process.env.NODE_ENV === 'production';

const redactConfig = {
  paths: PHI_REDACT_PATHS,
  censor: '[PHI_REDACTED]',
};

/**
 * Pino logger singleton.
 *
 * Production: GCP Cloud Logging JSON format via @google-cloud/pino-logging-gcp-config.
 *   - Severity mapping (Pino levels -> GCP severity)
 *   - Automatic stack_trace extraction for Cloud Error Reporting
 *   - Sequential insertId for log ordering
 *   - serviceContext for Error Reporting grouping
 *
 * Development/Test: pino-pretty for human-readable output.
 */
export const logger = isProduction
  ? pino(
      createGcpLoggingPinoConfig(
        {
          serviceContext: {
            service: 'flashnote-web',
            version: process.env.DEPLOY_VERSION || 'unknown',
          },
        },
        {
          level: process.env.LOG_LEVEL || 'info',
          base: undefined, // Remove pid/hostname -- Cloud Run metadata provides these
          redact: redactConfig,
        }
      )
    )
  : pino({
      level: process.env.LOG_LEVEL || 'debug',
      redact: redactConfig,
      // pino-pretty transport is only used in dev/test.
      // In test environment, skip the transport to avoid worker thread overhead
      // and write raw JSON (tests that verify logging mock the logger anyway).
      ...(process.env.NODE_ENV !== 'test'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                ignore: 'pid,hostname',
                translateTime: 'HH:MM:ss.l',
              },
            },
          }
        : {}),
    });
