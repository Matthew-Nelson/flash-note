import { describe, it, expect } from 'vitest';
import {
  MAX_SEARCH_LENGTH,
  searchListParamsSchema,
  singleParam,
} from './list-params';
import { notesListParamsSchema } from './notes';
import { z } from 'zod';

describe('singleParam', () => {
  it('passes a plain string through', () => {
    expect(singleParam(z.string()).parse('knee')).toBe('knee');
  });

  it('collapses a repeated param to its first occurrence', () => {
    expect(singleParam(z.string()).parse(['a', 'b'])).toBe('a');
  });

  it('leaves undefined alone for optional fields', () => {
    expect(singleParam(z.string()).optional().parse(undefined)).toBeUndefined();
  });
});

describe('searchListParamsSchema', () => {
  it('trims the search term', () => {
    expect(searchListParamsSchema.parse({ q: '  knee  ' }).q).toBe('knee');
  });

  it('defaults to an empty term and page 1', () => {
    expect(searchListParamsSchema.parse({})).toEqual({ q: '', page: 1 });
  });

  // Regression: ?q=a&q=b previously threw TypeError (sp.q.trim is not a
  // function) and dropped the route into the error boundary.
  it('does not throw on a repeated q param', () => {
    expect(searchListParamsSchema.parse({ q: ['a', 'b'] }).q).toBe('a');
  });

  it('does not throw on a repeated page param', () => {
    expect(searchListParamsSchema.parse({ page: ['2', '5'] }).page).toBe(2);
  });

  it('truncates an over-long term to the SQL bound', () => {
    const parsed = searchListParamsSchema.parse({ q: 'x'.repeat(500) });
    expect(parsed.q).toHaveLength(MAX_SEARCH_LENGTH);
  });

  it('falls back to page 1 for junk, zero, and negative pages', () => {
    expect(searchListParamsSchema.parse({ page: 'abc' }).page).toBe(1);
    expect(searchListParamsSchema.parse({ page: '0' }).page).toBe(1);
    expect(searchListParamsSchema.parse({ page: '-3' }).page).toBe(1);
  });

  it('coerces a numeric page string', () => {
    expect(searchListParamsSchema.parse({ page: '4' }).page).toBe(4);
  });
});

describe('notesListParamsSchema', () => {
  it('accepts the full filter set', () => {
    expect(
      notesListParamsSchema.parse({
        q: 'knee',
        page: '2',
        noteType: 'initial_eval',
        patientId: '00000000-0000-0000-0000-0000000abcde',
      }),
    ).toEqual({
      q: 'knee',
      page: 2,
      noteType: 'initial_eval',
      patientId: '00000000-0000-0000-0000-0000000abcde',
    });
  });

  it('drops an unknown noteType instead of throwing', () => {
    expect(notesListParamsSchema.parse({ noteType: 'not_a_type' }).noteType)
      .toBeUndefined();
  });

  it('drops a non-UUID patientId instead of throwing', () => {
    expect(notesListParamsSchema.parse({ patientId: 'nope' }).patientId)
      .toBeUndefined();
  });

  it('survives every param arriving as an array', () => {
    expect(
      notesListParamsSchema.parse({
        q: ['knee', 'shoulder'],
        page: ['3'],
        noteType: ['discharge'],
        patientId: ['00000000-0000-0000-0000-0000000abcde'],
      }),
    ).toEqual({
      q: 'knee',
      page: 3,
      noteType: 'discharge',
      patientId: '00000000-0000-0000-0000-0000000abcde',
    });
  });
});
