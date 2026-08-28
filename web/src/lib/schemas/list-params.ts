import { z } from 'zod';

/**
 * URL search-param schemas for list pages — Rule 3 boundary.
 *
 * Two hazards these exist to absorb:
 *
 *  1. Next.js resolves a repeated query param (`?q=a&q=b`) to `string[]`, not
 *     `string`. A hand-typed or shared link must not throw, so every field is
 *     normalized through `singleParam` before validation. First occurrence
 *     wins.
 *  2. A search term reaches SQL as an unindexed leading-wildcard ILIKE that
 *     runs in both the count and the list query, so it is length-capped here
 *     rather than trusted from the URL.
 *
 * Every field degrades to its default instead of throwing: a malformed param
 * yields the unfiltered list, never a 500. That is safe because the DAL scopes
 * every row to the caller regardless of what the URL asked for.
 */

/** Server-side cap on a search term; mirrored by `maxLength` on the inputs. */
export const MAX_SEARCH_LENGTH = 100;

/**
 * Accept the `string | string[] | undefined` that Next.js actually delivers,
 * collapsing a repeated param to its first occurrence before validation.
 */
export function singleParam<T extends z.ZodTypeAny>(
  schema: T
): z.ZodEffects<T, T['_output'], unknown> {
  return z.preprocess(
    (value) => (Array.isArray(value) ? value[0] : value),
    schema
  );
}

/**
 * `?q=` + `?page=` — the shape shared by /dashboard/notes and
 * /dashboard/patients. Over-long terms are truncated rather than rejected so
 * the user sees results for what they typed instead of a silently empty or
 * silently unfiltered list.
 */
export const searchListParamsSchema = z.object({
  q: singleParam(
    z.string().transform((value) => value.trim().slice(0, MAX_SEARCH_LENGTH))
  ).catch(''),
  page: singleParam(z.coerce.number().int().min(1)).catch(1),
});

export type SearchListParams = z.infer<typeof searchListParamsSchema>;
