---
description: Multi-agent workflow — plan, review, implement, code review, and PR
allowed-tools: Agent, Read, Write, Edit, Grep, Glob, Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(mkdir:*), AskUserQuestion
---

Execute a multi-agent implementation workflow for the following task:

**Task:** $ARGUMENTS

---

## Instructions

You are an orchestrator. Coordinate specialized agents through 5 phases. Follow these rules:

1. **Do not implement anything yourself.** Delegate all work to agents.
2. **Pass context between agents via temp files** in `/tmp/flashnote-workflow/`. Run `mkdir -p /tmp/flashnote-workflow` first.
3. **Read every agent output file before spawning the next agent.** Verify the output makes sense. If it looks wrong, stop and report to the user.
4. **Enforce iteration limits.** Plan review: 2 rounds max. Code review: 2 rounds max. Never exceed these.
5. **Pause at human checkpoints** (after plan review, before commit). Present a clear summary and ask the user before proceeding.
6. **Run quality gates yourself** — do not delegate test/coverage/typecheck commands to agents. Run them directly and verify the output.
7. **If an agent writes a `QUESTION:` line in its output**, stop and ask the user that question using AskUserQuestion before continuing.

---

## Phase 1: Planning

Launch a **sonnet agent**:

> You are a technical architect for the FlashNote healthcare application.
>
> 1. Read `CLAUDE.md` to understand project standards and architecture
> 2. Read `docs/ROADMAP.md` to understand current project state
> 3. Read the relevant source files for the task area
> 4. Read existing test files for the task area — understand current patterns before proposing new tests
> 5. Read `web/src/test/dal-helpers.ts` and `web/src/test/helpers.ts` — these provide shared test utilities (`mockDbQuery`, `setupMockClient`, `createMockUserRow`, etc.). New tests MUST use these helpers instead of reinventing mocking patterns.
> 6. Create a detailed implementation plan:
>    - Files to modify or create (with full paths from project root)
>    - Specific changes per file (reference line numbers where possible)
>    - Tests to write or update (using existing test helpers from `web/src/test/`)
>    - Risks and edge cases
>    - Order of operations
>    - `docs/ROADMAP.md` update: which line item to mark done
> 7. If you encounter ambiguity that affects the approach, write it as a `QUESTION:` line — do not guess
> 8. Write the plan to `/tmp/flashnote-workflow/plan.md`
>
> Task: $ARGUMENTS

Tools: `Read, Grep, Glob, Write`

---

## Phase 2: Plan Review (2 rounds max)

### Round 1

Read `/tmp/flashnote-workflow/plan.md`. Check for `QUESTION:` lines — if found, ask the user before proceeding.

Launch an **opus agent**:

> You are a senior engineer reviewing an implementation plan for a HIPAA-regulated healthcare app.
>
> Read `CLAUDE.md` first for mandatory engineering rules.
> Read the plan at `/tmp/flashnote-workflow/plan.md` and the source files it references.
>
> Evaluate:
> - **Correctness**: Will this work? Are file paths and references accurate?
> - **Completeness**: Missing steps, edge cases, or files?
> - **DAL boundary** (Rule 5): Does all data access go through the DAL? No direct `db`/`pool` imports in actions, components, or pages.
> - **Security**: HIPAA compliance, input validation, auth patterns. Specifically: no PHI in logs/errors (note content, patient names, diagnosis), no `logger.info/debug/error` calls that include user-provided clinical content.
> - **Server Action pattern**: Actions return `{ success: true, data } | { success: false, error: string }` where `error` is a code, not a message. No `throw` for expected errors.
> - **Scope**: Over-engineering or under-engineering?
> - **Testing**: Sufficient test coverage? Tests use shared helpers from `web/src/test/dal-helpers.ts`?
>
> If you have questions about intent or requirements that would change your review, write them as `QUESTION:` lines.
>
> Write your review to `/tmp/flashnote-workflow/review-round-1.md` with this structure:
> ```
> VERDICT: APPROVED
> ```
> or
> ```
> VERDICT: NEEDS_REVISION
>
> ## Issues
> 1. [severity: critical|major|minor] description...
> 2. ...
> ```

Tools: `Read, Grep, Glob, Write`

### Handling Round 1 Result

Read `/tmp/flashnote-workflow/review-round-1.md`. Check for `QUESTION:` lines — ask the user if found.

- If verdict is `APPROVED` → proceed to Human Checkpoint 1.
- If `NEEDS_REVISION` → launch a **sonnet agent** to revise:

> Read your original plan (`/tmp/flashnote-workflow/plan.md`) and the review feedback (`/tmp/flashnote-workflow/review-round-1.md`).
> Revise the plan to address all valid feedback. Only change what was called out.
> Write the revised plan to `/tmp/flashnote-workflow/plan-final.md`

Tools: `Read, Grep, Glob, Write`

Then launch an **opus agent** for final check:

> Final plan review. Read the revised plan (`/tmp/flashnote-workflow/plan-final.md`) and original feedback (`/tmp/flashnote-workflow/review-round-1.md`).
> Verify the revision addresses the feedback.
> Write to `/tmp/flashnote-workflow/review-round-2.md`:
> ```
> VERDICT: APPROVED
> ```
> or
> ```
> VERDICT: APPROVED_WITH_NOTES
>
> ## Notes
> ...
> ```
>
> Do NOT request another revision. This is the final gate.

Tools: `Read, Grep, Glob, Write`

---

## Human Checkpoint 1: Plan Approval

**⛔ STOP. DO NOT PROCEED TO PHASE 3 UNTIL THE USER RESPONDS.**

Read `/tmp/flashnote-workflow/plan-final.md` (or `plan.md` if final doesn't exist). Extract:
- List of files to be modified/created
- The core approach in 2-3 sentences
- Any risks or reviewer notes

Present to the user:

> **Plan Review Complete**
>
> The implementation plan has been reviewed and approved.
>
> **Files to be modified/created:**
> [List from plan]
>
> **Approach:**
> [2-3 sentence summary]
>
> **Risks/Notes:**
> [From reviewer]
>
> Full plan: `/tmp/flashnote-workflow/plan-final.md`

**NOW CALL AskUserQuestion** (this is mandatory):

```
question: "The plan has been reviewed and approved. Ready to proceed with implementation?"
header: "Plan Approval"
multiSelect: false
options:
  - label: "Proceed"
    description: "Implement according to the approved plan"
  - label: "Abort"
    description: "Stop the workflow, discard plan, clean up temp files"
  - label: "Provide feedback"
    description: "I want changes to the plan before implementation"
```

**Wait for user response. Only continue after receiving it:**

- If **Proceed** → continue to Phase 3
- If **Abort** → clean up `/tmp/flashnote-workflow/`, stop the workflow, report to user
- If **Provide feedback** → get the user's notes (they can provide them in the response), spawn a sonnet agent to revise the plan to address the notes, then re-run Phase 2 Round 2 review, then return to this checkpoint

---

## Phase 3: Implementation

Determine which plan file is final (`plan-final.md` if it exists, otherwise `plan.md`). Read it.

Launch a **sonnet agent** with `isolation: worktree`:

> You are an expert developer implementing an approved plan for FlashNote.
>
> Read `CLAUDE.md` first — mandatory engineering rules apply.
> Read the approved plan at `/tmp/flashnote-workflow/[final plan file]`.
>
> **Key patterns you MUST follow:**
> - All data access goes through the DAL (`web/src/server/dal/`). Never import `db` or `pool` in actions, components, or pages.
> - Server Actions return `{ success: true, data } | { success: false, error: string }` where `error` is a code (e.g., `'unauthenticated'`), not a human message. Never `throw` for expected errors.
> - NEVER log PHI — no note content, patient names, diagnosis, or treatment details in any `logger.*` call.
> - Tests must use shared helpers from `web/src/test/dal-helpers.ts` (`mockDbQuery`, `setupMockClient`, `createMockUserRow`, etc.) and `web/src/test/helpers.ts`. Use the `vi.hoisted(() => vi.fn())` pattern for mock declarations used in `vi.mock` factories.
>
> Implement step by step:
> 1. Read each file before modifying it
> 2. Make the specified changes
> 3. Write or update tests as specified
> 4. If you encounter ambiguity in the plan, write it as a `QUESTION:` line in your summary — do not guess
>
> Do NOT run tests yourself — the orchestrator will handle that.
>
> When done, commit all changes in the worktree with a descriptive message so the orchestrator can retrieve them.
>
> Write a summary to `/tmp/flashnote-workflow/implementation-summary.md`:
> - Files modified/created (full paths)
> - Tests added/modified
> - Deviations from plan (if any) and why
> - Any `QUESTION:` items
> - The worktree branch name (from `git branch --show-current`)

Tools: `Read, Write, Edit, Grep, Glob, Bash`

---

## Quality Gate 1: Post-Implementation

**Run these commands yourself (do not delegate to an agent):**

```bash
cd web && pnpm test --run --coverage
cd web && pnpm exec tsc --noEmit
cd web && pnpm lint
```

Check the output:
- **All tests pass?** Continue.
- **Coverage meets threshold?** (95% lines, 95% functions, 95% branches, 95% statements — per `web/vitest.config.ts`) Continue.
- **Zero TypeScript errors?** Continue.
- **Zero lint errors?** Continue.

**If any check fails:** Launch a **sonnet agent** to fix:

> The quality gate failed after implementation. Fix the issues below.
>
> [paste the failing output]
>
> Run the failing command again after your fix to verify.

Tools: `Read, Write, Edit, Grep, Glob, Bash`

After the fix agent completes, **re-run all quality gate checks**. If they still fail after this second attempt, **stop and report to the user** with the failing output.

---

## Phase 4: Code Review (2 rounds max)

### Round 1

Read `/tmp/flashnote-workflow/implementation-summary.md`. Launch an **opus agent**:

> You are a strict code reviewer for a HIPAA-regulated healthcare app.
>
> Read `CLAUDE.md` for mandatory engineering rules.
> Run `git diff` to see all changes. Read the modified files.
>
> Evaluate:
> - **Bugs**: Logic errors, null checks, race conditions
> - **DAL boundary** (Rule 5): ALL data access goes through `web/src/server/dal/`. Flag any direct `db`/`pool` imports in actions, components, or pages as critical.
> - **PHI in logs**: Check every `logger.*` call in the diff. ANY logging of note content, patient names, diagnosis, treatment details, or raw user clinical input is a critical finding.
> - **Server Action return pattern**: Actions must return `{ success: true, data } | { success: false, error: string }` where `error` is a code. No `throw` for expected errors. No raw `err.message` in returns (Rule 7).
> - **Security**: Injection, missing auth/validation, multi-step operations without transactions (Rule 1)
> - **CLAUDE.md compliance**: All 10 mandatory rules — especially Rule 10 (defensive DB row checks, no `rows[0]!`)
> - **Test quality**: Tests exercise real behavior (Rule 6). Tests use shared helpers from `web/src/test/dal-helpers.ts`, not custom mocking.
> - **Code quality**: No dead code, no over-engineering
>
> Write to `/tmp/flashnote-workflow/code-review-round-1.md`:
> ```
> VERDICT: CODE_APPROVED
> ```
> or
> ```
> VERDICT: CHANGES_REQUESTED
>
> ## Issues
> 1. [critical] `web/src/server/dal/auth.ts:42` — description... Suggested fix: ...
> 2. [major] `web/src/actions/notes.ts:15` — description... Suggested fix: ...
> ```
>
> Only flag real issues. No style nitpicks beyond the task scope.

Tools: `Read, Grep, Glob, Bash(git:*)`

### Handling Round 1 Result

Read `/tmp/flashnote-workflow/code-review-round-1.md`.

- If `CODE_APPROVED` → proceed to Quality Gate 2.
- If `CHANGES_REQUESTED` → launch a **sonnet agent** to fix:

> Fix the issues in `/tmp/flashnote-workflow/code-review-round-1.md`.
> Fix all critical and major issues. Fix minor issues if straightforward.
> Write summary to `/tmp/flashnote-workflow/fixes-summary.md`.

Tools: `Read, Write, Edit, Grep, Glob, Bash`

Then launch an **opus agent** for final review:

> Final code review. Read the original issues (`/tmp/flashnote-workflow/code-review-round-1.md`) and the fixes summary (`/tmp/flashnote-workflow/fixes-summary.md`).
> Verify fixes via `git diff`.
> Write to `/tmp/flashnote-workflow/code-review-round-2.md`:
> ```
> VERDICT: CODE_APPROVED
> ```
> or
> ```
> VERDICT: CODE_APPROVED_WITH_NOTES
>
> ## Notes
> ...
> ```
>
> Do NOT request another round. Approve or flag critical blockers for the user.

Tools: `Read, Grep, Glob, Bash(git:*)`

---

## Quality Gate 2: Pre-Commit

**Run the same checks again:**

```bash
cd web && pnpm test --run --coverage
cd web && pnpm exec tsc --noEmit
cd web && pnpm lint
```

If any check fails after the code review fixes, **stop and report to the user**. Do not attempt another fix round — something is structurally wrong.

---

## Human Checkpoint 2: Pre-Commit Review

**⛔ STOP. DO NOT COMMIT OR CREATE PR UNTIL THE USER RESPONDS.**

Run `git diff --stat` to get the file change summary. Read `/tmp/flashnote-workflow/implementation-summary.md` and `/tmp/flashnote-workflow/code-review-round-2.md`.

Present to the user:

> **Implementation Complete — Ready for Commit**
>
> **Files changed:**
> [Output of `git diff --stat`]
>
> **What was implemented:**
> [Summary from implementation-summary.md]
>
> **Code review:**
> [Result: APPROVED or APPROVED_WITH_NOTES]
>
> **Quality gates:**
> ✅ All tests pass
> ✅ Coverage thresholds met (95%)
> ✅ TypeScript: zero errors
> ✅ Lint: zero errors
>
> **Branch to be created:**
> `feat/<short-description>-<hash>`

**NOW CALL AskUserQuestion** (this is mandatory):

```
question: "Implementation complete and all checks pass. Ready to commit and create a PR?"
header: "Pre-Commit Review"
multiSelect: false
options:
  - label: "Proceed"
    description: "Commit changes, push, and create a pull request"
  - label: "Abort"
    description: "Stop here; changes remain in worktree but nothing is committed"
  - label: "Request changes"
    description: "I want fixes before committing"
```

**Wait for user response. Only continue after receiving it:**

- If **Proceed** → continue to Phase 5 (commit and create PR)
- If **Abort** → report status to user, clean up `/tmp/flashnote-workflow/`, exit gracefully (worktree remains for manual inspection if needed)
- If **Request changes** → get the user's change description (from their response notes), spawn a sonnet agent to fix, then re-run Quality Gate 2 checks, then return to this checkpoint

---

## Phase 5: Merge Worktree, Commit, and PR

### Create Feature Branch and Merge Worktree

**⚠️ NEVER merge worktree changes into `main`.** Always create the feature branch first.

1. Read the worktree branch name from `/tmp/flashnote-workflow/implementation-summary.md`
2. Ensure you are on `main`: `git checkout main`
3. **Create the feature branch FIRST:** `git checkout -b feat/<short-task-description>-<short-hash>` (include first 6 chars of timestamp to avoid collisions)
4. **Merge worktree into the feature branch:** `git merge <worktree-branch> --no-ff`
5. **Clean up the worktree:**
   ```bash
   git worktree remove <worktree-path> 2>/dev/null; git worktree prune
   git worktree list  # Verify: only main working directory should appear
   ```
6. **Delete the worktree branch** (its commits are now on the feature branch): `git branch -D <worktree-branch>`

### Commit

1. Stage relevant files selectively — do NOT use `git add -A`
2. **Update `docs/ROADMAP.md`** to mark the completed task item as done. Stage this file too.
3. Commit with conventional commit message:
   ```
   feat(scope): short description

   - Bullet points of what changed
   - Bullet points of what changed

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   ```
4. `git push -u origin <branch>`
5. `gh pr create` with:
   - Clear title (under 70 chars)
   - Body with: summary of changes, approach taken, code review notes, smoke test plan

**Report the PR URL to the user.**

**Final cleanup:**
1. Run `git worktree list` — should be empty
2. Run `git worktree prune` again to be sure
3. Remove `/tmp/flashnote-workflow/` directory

---

## Failure Handling

| Situation | Action |
|---|---|
| Agent output looks fundamentally wrong | Stop, report to user |
| Agent writes `QUESTION:` lines | Stop, ask user via AskUserQuestion, pass answer to next agent |
| Quality gate fails after 2 fix attempts | Stop, report failing output to user |
| Critical security issues unfixed after round 2 | Stop, report to user |
| `gh pr create` fails | Report error, leave branch pushed for manual PR |
| Workflow aborted at any checkpoint | Run manual cleanup (see below) |

---

## Manual Cleanup (if workflow is aborted)

If the workflow stops before PR creation:

```bash
# Clean up isolated worktree
git worktree list              # See all worktrees
git worktree remove <path>     # Remove by path if needed
git worktree prune             # Clean up dangling worktree refs
git branch -D <feature-branch> # Delete the feature branch if it exists locally

# Clean up temp workflow files
rm -rf /tmp/flashnote-workflow/

# Verify clean state
git status                      # Should show clean working tree
git worktree list              # Should be empty
```
