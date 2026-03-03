---
description: Multi-agent workflow — plan, review, implement, code review, and PR
allowed-tools: Agent, Read, Write, Edit, Grep, Glob, Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(mkdir:*), Bash(rm:*), Bash(ls:*), Bash(cd:*), AskUserQuestion
---

Execute a multi-agent implementation workflow for the following task:

**Task:** $ARGUMENTS

---

## Instructions

You are an orchestrator. Coordinate specialized agents through 5 phases. Follow these rules:

1. **Do not implement anything yourself.** Delegate all work to agents.
2. **Read every agent output file before spawning the next agent.** Verify the output makes sense. If it looks wrong, stop and report to the user.
3. **Enforce iteration limits.** Plan review: 2 rounds max. Code review: 2 rounds max. Never exceed these.
4. **Pause at human checkpoints.** Use AskUserQuestion immediately — do NOT spawn agents or run commands until you receive the user's response.
5. **Run quality gates yourself** — do not delegate test/coverage/typecheck commands to agents.
6. **If an agent writes a `QUESTION:` line in its output**, stop and ask the user that question using AskUserQuestion before continuing.

---

## Pre-flight

Run these steps yourself (not delegated):

1. Capture project root — use this for all subsequent path references:
   ```bash
   git rev-parse --show-toplevel
   ```
   Store the output as `PROJECT_ROOT`.

2. Check working tree:
   ```bash
   git status --porcelain
   ```
   If dirty, use AskUserQuestion:
   - "Stash and continue" → `git stash push -m "implement-task: auto-stash"` (record that a stash was created)
   - "Abort" → stop

3. Check current branch:
   ```bash
   git branch --show-current
   ```
   If not `main`, STOP and tell the user to switch to main first.

4. Create temp directory — use `date +%s` to get a timestamp, then use the literal value:
   ```bash
   date +%s
   ```
   Then:
   ```bash
   mkdir -p /tmp/flashnote-<TIMESTAMP>
   ```
   Store the full path as `WORKFLOW_DIR`.

5. Create feature branch — derive a slug from the task description (lowercase, hyphens, max 50 chars):
   ```bash
   git checkout -b feat/<slug>
   ```
   Store as `FEATURE_BRANCH`. This is the final branch name — no rename later.

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
> 8. Write the plan to exactly `<WORKFLOW_DIR>/plan.md` — this exact path and filename, no variations
>
> Task: $ARGUMENTS

Tools: `Read, Grep, Glob, Write`

---

## Phase 2: Plan Review (2 rounds max)

### Round 1

Read `<WORKFLOW_DIR>/plan.md`. Check for `QUESTION:` lines — if found, ask the user before proceeding.

Launch an **opus agent**:

> You are a senior engineer reviewing an implementation plan for a HIPAA-regulated healthcare app.
>
> Read `CLAUDE.md` first for mandatory engineering rules.
> Read the plan at `<WORKFLOW_DIR>/plan.md` and the source files it references.
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
> Write your review to `<WORKFLOW_DIR>/review-round-1.md` with this structure:
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

Read `<WORKFLOW_DIR>/review-round-1.md`. Check for `QUESTION:` lines — ask the user if found.

- If verdict is `APPROVED` → proceed to Checkpoint 1.
- If `NEEDS_REVISION` → launch a **sonnet agent** to revise:

> Read your original plan (`<WORKFLOW_DIR>/plan.md`) and the review feedback (`<WORKFLOW_DIR>/review-round-1.md`).
> Revise the plan to address all valid feedback. Only change what was called out.
> Write the revised plan to `<WORKFLOW_DIR>/plan-final.md`

Tools: `Read, Grep, Glob, Write`

Then launch an **opus agent** for final check:

> Final plan review. Read the revised plan (`<WORKFLOW_DIR>/plan-final.md`) and original feedback (`<WORKFLOW_DIR>/review-round-1.md`).
> Verify the revision addresses the feedback.
> Write to `<WORKFLOW_DIR>/review-round-2.md`:
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

## ===== CHECKPOINT: Plan Approval =====

Read the final plan (`plan-final.md` if it exists, otherwise `plan.md`). Extract a summary:
- Files to be modified/created
- The core approach in 2-3 sentences
- Any risks or reviewer notes
- Path to the full plan file

Present the summary as text, then **immediately** call AskUserQuestion:
- question: "The plan has been reviewed and approved. Ready to proceed with implementation?"
- header: "Plan"
- multiSelect: false
- options:
  1. "Proceed" — Implement according to the approved plan
  2. "Abort" — Stop the workflow and clean up
  3. "Provide feedback" — I want changes before implementation

**Do NOT spawn any agents, run any commands, or do any other work until you receive the user's response.**

- **Proceed** → continue to Phase 3
- **Abort** → jump to Abort/Cleanup
- **Provide feedback** → get the user's notes, spawn a sonnet agent to revise the plan, re-run Phase 2 Round 2, return to this checkpoint

---

## Phase 3: Implementation

Determine which plan file is final (`plan-final.md` if it exists, otherwise `plan.md`). Read it.

Launch a **sonnet agent** (NO `isolation: worktree` — agent works on the feature branch in the main repo):

> You are an expert developer implementing an approved plan for FlashNote.
>
> Read `CLAUDE.md` first — mandatory engineering rules apply.
> Read the approved plan at `<WORKFLOW_DIR>/[final plan file]`.
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
> Do NOT run tests yourself — the orchestrator will handle quality gates.
>
> When done, commit all changes using conventional commit format:
> ```
> <type>(<scope>): <description>
>
> <body>
>
> Co-Authored-By: Claude <noreply@anthropic.com>
> ```
> Use `git add <specific files>` — do NOT use `git add -A` or `git add .`.
>
> Write a summary to `<WORKFLOW_DIR>/implementation-summary.md`:
> - Files modified/created (full paths)
> - Tests added/modified
> - Deviations from plan (if any) and why
> - Any `QUESTION:` items

Tools: `Read, Write, Edit, Grep, Glob, Bash(git:*)`

---

## Quality Gate

Run these commands yourself — do NOT delegate to agents. Use `PROJECT_ROOT` from pre-flight.

**Conditional dependency install** (only if package.json or lockfile changed):
```bash
git diff main..HEAD --name-only | grep -qE '(package\.json|pnpm-lock\.yaml)' && \
  cd <PROJECT_ROOT>/web && pnpm install --frozen-lockfile
```

**Always run:**
```bash
cd <PROJECT_ROOT>/web && pnpm test:ci
cd <PROJECT_ROOT>/web && pnpm exec tsc --noEmit
cd <PROJECT_ROOT>/web && pnpm lint
```

Check: all tests pass, coverage thresholds met (95%), zero TypeScript errors, zero lint errors.

**If any check fails:** Launch a **sonnet agent** to fix:

> Quality gate failed. Fix the issues below.
>
> [paste the failing output]
>
> Commit fixes with `git add <files> && git commit -m "fix: ..."`.
> Do NOT run tests yourself — the orchestrator will re-verify.

Tools: `Read, Write, Edit, Grep, Glob, Bash(git:*)`

After the fix agent returns, **re-run all quality gate checks**. If they still fail after 2 fix attempts, **stop and report to the user**.

---

## Phase 4: Code Review (2 rounds max)

### Round 1

Read `<WORKFLOW_DIR>/implementation-summary.md`. Launch an **opus agent**:

> You are a strict code reviewer for a HIPAA-regulated healthcare app.
>
> Read `CLAUDE.md` for mandatory engineering rules.
> Run `git diff main..HEAD` to see all changes. Read the modified files.
>
> Evaluate:
> - **Bugs**: Logic errors, null checks, race conditions
> - **DAL boundary** (Rule 5): ALL data access goes through `web/src/server/dal/`. Flag any direct `db`/`pool` imports in actions, components, or pages as critical.
> - **PHI in logs**: Check every `logger.*` call in the diff. ANY logging of note content, patient names, diagnosis, treatment details, or raw user clinical input is a critical finding.
> - **Server Action return pattern**: Actions must return `{ success: true, data } | { success: false, error: string }` where `error` is a code. No `throw` for expected errors. No raw `err.message` in returns (Rule 7).
> - **Security**: Injection, missing auth/validation, multi-step operations without transactions (Rule 1)
> - **CLAUDE.md compliance**: All mandatory rules — especially Rule 10 (defensive DB row checks, no `rows[0]!`)
> - **Test quality**: Tests exercise real behavior (Rule 6). Tests use shared helpers from `web/src/test/dal-helpers.ts`, not custom mocking.
> - **Code quality**: No dead code, no over-engineering
>
> Write to `<WORKFLOW_DIR>/code-review-round-1.md`:
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

Read `<WORKFLOW_DIR>/code-review-round-1.md`.

- If `CODE_APPROVED` → proceed to Checkpoint 2.
- If `CHANGES_REQUESTED` → launch a **sonnet agent** to fix:

> Fix the issues in `<WORKFLOW_DIR>/code-review-round-1.md`.
> Fix all critical and major issues. Fix minor issues if straightforward.
> Commit fixes with `git add <files> && git commit -m "fix: ..."`.
> Write summary to `<WORKFLOW_DIR>/fixes-summary.md`.

Tools: `Read, Write, Edit, Grep, Glob, Bash(git:*)`

Then re-run the Quality Gate. Then launch an **opus agent** for final review:

> Final code review. Read the original issues (`<WORKFLOW_DIR>/code-review-round-1.md`) and the fixes summary (`<WORKFLOW_DIR>/fixes-summary.md`).
> Verify fixes via `git diff main..HEAD`.
> Write to `<WORKFLOW_DIR>/code-review-round-2.md`:
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

## ===== CHECKPOINT: Pre-Push Review =====

Run `git diff --stat main..HEAD` and read `<WORKFLOW_DIR>/implementation-summary.md` and the latest code review file.

Present a summary:
- Files changed (diff stat output)
- What was implemented
- Code review result
- Quality gate status
- Branch name: `FEATURE_BRANCH`

Then **immediately** call AskUserQuestion:
- question: "Implementation complete and all checks pass. Ready to push and create a PR?"
- header: "Pre-Push"
- multiSelect: false
- options:
  1. "Proceed" — Push and create a pull request
  2. "Abort" — Discard the feature branch and clean up
  3. "Request changes" — I want fixes before pushing

**Do NOT spawn any agents, run any commands, or do any other work until you receive the user's response.**

- **Proceed** → continue to Phase 5
- **Abort** → jump to Abort/Cleanup
- **Request changes** → get notes, spawn sonnet fix agent, re-run quality gate, return to this checkpoint

---

## Phase 5: Push and PR

1. Update `docs/ROADMAP.md` to mark the completed task. Stage and commit:
   ```bash
   git add docs/ROADMAP.md && git commit -m "$(cat <<'EOF'
   docs: mark task complete in ROADMAP

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```

2. Push the branch:
   ```bash
   git push -u origin <FEATURE_BRANCH>
   ```

3. Create the PR:
   ```bash
   gh pr create --head <FEATURE_BRANCH> --base main \
     --title "<clear title under 70 chars>" \
     --body "$(cat <<'EOF'
   ## Summary
   <bullet points of what changed>

   ## Approach
   <brief description of approach taken>

   ## Code Review Notes
   <any notes from code review>

   ## Test Plan
   <smoke test checklist>

   Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

4. **Report the PR URL to the user.**

5. Clean up temp files:
   ```bash
   rm -rf <WORKFLOW_DIR>
   ```

---

## Abort/Cleanup

Run at any point when the workflow is aborted:

```bash
git checkout -f main
git branch -D <FEATURE_BRANCH>
rm -rf <WORKFLOW_DIR>
```

If a stash was created during pre-flight:
```bash
git stash pop
```

The `-f` flag on checkout is intentional — on abort, we discard uncommitted changes on the feature branch. Committed work is recoverable via `git reflog`.

---

## Failure Handling

| Situation | Action |
|---|---|
| Agent output looks fundamentally wrong | Stop, report to user |
| Agent writes `QUESTION:` lines | Stop, ask user via AskUserQuestion, pass answer to next agent |
| Quality gate fails after 2 fix attempts | Stop, report failing output to user |
| Critical security issues unfixed after round 2 | Stop, report to user |
| `gh pr create` fails | Report error, leave branch pushed for manual PR |
| Workflow aborted at any checkpoint | Run Abort/Cleanup |
