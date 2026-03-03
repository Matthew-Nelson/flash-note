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
2. **Create a unique temp directory first.** Run `mkdir -p /tmp/flashnote-workflow-$(date +%s)`. Store the resulting absolute path as `WORKFLOW_DIR` and use it for ALL temp files throughout the workflow. When passing paths to agents, substitute the actual path — agents do not know the `<WORKFLOW_DIR>` placeholder.
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

- If verdict is `APPROVED` → proceed to Human Checkpoint 1.
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

## Human Checkpoint 1: Plan Approval

**⛔ STOP. DO NOT PROCEED TO PHASE 3 UNTIL THE USER RESPONDS.**

Read `<WORKFLOW_DIR>/plan-final.md` (or `plan.md` if final doesn't exist). Extract:
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
> Full plan: `<WORKFLOW_DIR>/plan-final.md`

Now call AskUserQuestion with these exact parameters:
- question: "The plan has been reviewed and approved. Ready to proceed with implementation?"
- header: "Plan Approval"
- multiSelect: false
- Three options:
  1. "Proceed" — Implement according to the approved plan
  2. "Abort" — Stop the workflow, discard plan, clean up temp files
  3. "Provide feedback" — I want changes to the plan before implementation

DO NOT continue to Phase 3 until you receive the user's response. Wait here.

- If **Proceed** → continue to Phase 3
- If **Abort** → clean up `<WORKFLOW_DIR>/`, stop the workflow, report to user
- If **Provide feedback** → get the user's notes (they can provide them in the response), spawn a sonnet agent to revise the plan to address the notes, then re-run Phase 2 Round 2 review, then return to this checkpoint

---

## Phase 3: Implementation

Determine which plan file is final (`plan-final.md` if it exists, otherwise `plan.md`). Read it.

Launch a **sonnet agent** with `isolation: worktree`:

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
> **Before making any changes**, record the starting state:
> - Run `pwd` and save the absolute path — this is the worktree path
> - Run `git rev-parse HEAD` and save the hash — this is the base commit before your changes
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
> Write a summary to `<WORKFLOW_DIR>/implementation-summary.md`:
> - **Worktree path**: the absolute path from `pwd` at the start
> - **Base commit hash**: the hash from `git rev-parse HEAD` before your changes
> - Files modified/created (full paths)
> - Tests added/modified
> - Deviations from plan (if any) and why
> - Any `QUESTION:` items
> - The worktree branch name (from `git branch --show-current`)

Tools: `Read, Write, Edit, Grep, Glob, Bash`

### Post-Implementation: Extract Worktree Context

After the implementation agent returns, **you (the orchestrator) must**:

1. Read `<WORKFLOW_DIR>/implementation-summary.md`
2. Extract these three values — all subsequent phases depend on them:
   - **`WORKTREE_PATH`** — the absolute worktree directory path
   - **`WORKTREE_BRANCH`** — the branch name
   - **`BASE_HASH`** — the pre-implementation commit hash
3. Verify the worktree exists: `ls <WORKTREE_PATH>/web/package.json`

**Fallback:** If the summary is missing the worktree path, the Agent tool's return value includes the worktree path and branch when `isolation: worktree` was used — extract them from there. If `BASE_HASH` is missing, you can derive it: `cd <WORKTREE_PATH> && git log --oneline | tail -1` to find the initial commit of the worktree branch, then use its parent. If you still can't determine all three values, **stop and report to the user**.

---

## Quality Gate 1: Post-Implementation

**Install dependencies first** — the worktree only contains tracked files, so `node_modules` does not exist:

```bash
cd <WORKTREE_PATH>/web && pnpm install --frozen-lockfile
```

**Then run these commands yourself (do not delegate to an agent):**

```bash
cd <WORKTREE_PATH>/web && pnpm test --run --coverage
cd <WORKTREE_PATH>/web && pnpm exec tsc --noEmit
cd <WORKTREE_PATH>/web && pnpm lint
```

Check the output:
- **All tests pass?** Continue.
- **Coverage meets threshold?** (95% lines, 95% functions, 95% branches, 95% statements — per `web/vitest.config.ts`) Continue.
- **Zero TypeScript errors?** Continue.
- **Zero lint errors?** Continue.

**If any check fails:** Launch a **sonnet agent** to fix:

> The quality gate failed after implementation. Fix the issues below.
>
> All source files are in the worktree at `<WORKTREE_PATH>`. Use absolute paths when reading/editing files. Run commands with `cd <WORKTREE_PATH>/web && ...`. Commit fixes in the worktree.
>
> [paste the failing output]
>
> Run the failing command again after your fix to verify.

Tools: `Read, Write, Edit, Grep, Glob, Bash`

**Do NOT set `isolation: worktree` on fix agents** — they must work in the existing worktree, not create a new one.

After the fix agent completes, **re-run all quality gate checks** (using `cd <WORKTREE_PATH>/web && ...`). If they still fail after this second attempt, **stop and report to the user** with the failing output.

---

## Phase 4: Code Review (2 rounds max)

### Round 1

Read `<WORKFLOW_DIR>/implementation-summary.md`. Launch an **opus agent**:

> You are a strict code reviewer for a HIPAA-regulated healthcare app.
>
> Read `CLAUDE.md` for mandatory engineering rules.
> Run `cd <WORKTREE_PATH> && git diff <BASE_HASH>..HEAD` to see all changes. Read the modified files using their absolute paths under `<WORKTREE_PATH>`.
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

- If `CODE_APPROVED` → proceed to Quality Gate 2.
- If `CHANGES_REQUESTED` → launch a **sonnet agent** to fix:

> Fix the issues in `<WORKFLOW_DIR>/code-review-round-1.md`.
> Fix all critical and major issues. Fix minor issues if straightforward.
>
> All source files are in the worktree at `<WORKTREE_PATH>`. Use absolute paths when reading/editing files. Run commands with `cd <WORKTREE_PATH>/web && ...`. Commit fixes in the worktree.
>
> Write summary to `<WORKFLOW_DIR>/fixes-summary.md`.

Tools: `Read, Write, Edit, Grep, Glob, Bash`

**Do NOT set `isolation: worktree` on fix agents** — they must work in the existing worktree.

Then launch an **opus agent** for final review:

> Final code review. Read the original issues (`<WORKFLOW_DIR>/code-review-round-1.md`) and the fixes summary (`<WORKFLOW_DIR>/fixes-summary.md`).
> Verify fixes via `cd <WORKTREE_PATH> && git diff <BASE_HASH>..HEAD`.
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

## Quality Gate 2: Pre-Commit

**Run the same checks again:**

```bash
cd <WORKTREE_PATH>/web && pnpm test --run --coverage
cd <WORKTREE_PATH>/web && pnpm exec tsc --noEmit
cd <WORKTREE_PATH>/web && pnpm lint
```

If any check fails after the code review fixes, **stop and report to the user**. Do not attempt another fix round — something is structurally wrong.

---

## Human Checkpoint 2: Pre-Commit Review

**⛔ STOP. DO NOT COMMIT OR CREATE PR UNTIL THE USER RESPONDS.**

Run `cd <WORKTREE_PATH> && git diff --stat <BASE_HASH>..HEAD` to get the file change summary. Read `<WORKFLOW_DIR>/implementation-summary.md` and `<WORKFLOW_DIR>/code-review-round-2.md` (or `code-review-round-1.md` if round 2 wasn't needed).

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
> All tests pass
> Coverage thresholds met (95%)
> TypeScript: zero errors
> Lint: zero errors
>
> **Branch to be created:**
> `feat/<short-description>-<hash>`

Now call AskUserQuestion with these exact parameters:
- question: "Implementation complete and all checks pass. Ready to commit and create a PR?"
- header: "Pre-Commit"
- multiSelect: false
- Three options:
  1. "Proceed" — Commit changes, push, and create a pull request
  2. "Abort" — Stop here; changes remain in worktree but nothing is committed
  3. "Request changes" — I want fixes before committing

DO NOT continue to Phase 5 until you receive the user's response. Wait here.

- If **Proceed** → continue to Phase 5
- If **Abort** → report status to user, clean up `<WORKFLOW_DIR>/`, exit gracefully (worktree remains for manual inspection if needed)
- If **Request changes** → get the user's change description (from their response notes), spawn a sonnet agent to fix (with worktree context as above), then re-run Quality Gate 2 checks, then return to this checkpoint

---

## Phase 5: Push and Create PR

### Rename Branch and Push

Choose a feature branch name: `feat/<short-task-description>-<hash>` (use first 6 chars of current timestamp or commit hash to avoid collisions). Call this `FEATURE_BRANCH` — use it consistently in all steps below.

1. Rename the worktree branch:
   ```bash
   cd <WORKTREE_PATH> && git branch -m <FEATURE_BRANCH>
   ```

2. **Update `docs/ROADMAP.md`** in the worktree to mark the completed task item as done. Stage and commit:
   ```bash
   cd <WORKTREE_PATH> && git add docs/ROADMAP.md && git commit -m "$(cat <<'EOF'
   docs: update ROADMAP.md — mark task complete

   Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

3. Push the branch from the worktree:
   ```bash
   cd <WORKTREE_PATH> && git push -u origin <FEATURE_BRANCH>
   ```

4. Create the PR:
   ```bash
   cd <WORKTREE_PATH> && gh pr create --head <FEATURE_BRANCH> --base main \
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

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

5. **Report the PR URL to the user.**

### Cleanup

```bash
# Return to the main repo directory first (can't remove a worktree from inside it)
cd $(git -C <WORKTREE_PATH> rev-parse --path-format=absolute --git-common-dir)/..
git worktree remove <WORKTREE_PATH> 2>/dev/null; git worktree prune

# Verify
git worktree list

# Clean up temp files
rm -rf <WORKFLOW_DIR>/
```

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
# Clean up worktree
git worktree list              # See all worktrees
git worktree remove <path>     # Remove the worktree by path
git worktree prune             # Clean up dangling worktree refs

# Clean up temp workflow files
rm -rf <WORKFLOW_DIR>/

# Verify clean state
git status                     # Should show clean working tree
git worktree list              # Should show only main working directory
```
