import { describe, it, expect } from 'vitest';
import {
  PATIENT_ERROR_MESSAGES,
  PATIENT_ERROR_FALLBACK,
  mapPatientError,
} from './error-messages';

describe('patient error-messages', () => {
  it('every required error code has a curated string', () => {
    const required = [
      'unauthenticated',
      'session_expired',
      'validation_error',
      'patient_not_found',
      'archive_failed',
      'context_save_failed',
      'rate_limit_exceeded',
      'internal_error',
    ];
    for (const code of required) {
      expect(PATIENT_ERROR_MESSAGES[code]).toBeTruthy();
      expect(typeof PATIENT_ERROR_MESSAGES[code]).toBe('string');
    }
  });

  it('fallback string is generic and does not reference server internals (Rule 2)', () => {
    expect(PATIENT_ERROR_FALLBACK).toBe('Something went wrong. Please try again.');
  });

  it('mapPatientError returns mapped string for known code', () => {
    expect(mapPatientError('patient_not_found')).toBe(
      PATIENT_ERROR_MESSAGES.patient_not_found,
    );
  });

  it('mapPatientError falls back to generic for unknown code', () => {
    expect(mapPatientError('totally_unmapped')).toBe(PATIENT_ERROR_FALLBACK);
  });

  it('mapPatientError falls back to generic for undefined', () => {
    expect(mapPatientError(undefined)).toBe(PATIENT_ERROR_FALLBACK);
  });

  it('mapPatientError falls back to generic for null', () => {
    expect(mapPatientError(null)).toBe(PATIENT_ERROR_FALLBACK);
  });

  it('mapPatientError falls back to generic for empty string', () => {
    expect(mapPatientError('')).toBe(PATIENT_ERROR_FALLBACK);
  });
});
