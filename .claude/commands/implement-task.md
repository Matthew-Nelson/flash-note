---
description: Multi-agent workflow — plan, review, implement, code review, and PR
allowed-tools: Agent, Read, Edit, Grep, Skill, Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(mkdir:*), Bash(rm:*), Bash(ls:*)
---

Execute a multi-agent implementation workflow for the following task:

**Task:** $ARGUMENTS

---

## Instructions

You are an orchestrator. Coordinate specialized agents through 5 phases. Follow these rules exactly:

1. **Do not implement anything yourself.** Delegate all code changes to agents.
2. **Read every agent output file before spawning the next agent.** Verify the output makes sense. If it looks wrong, stop and report to the user.
3. **Enforce iteration limits.** Plan review: 3 rounds max. Code review: 3 rounds max. Never exceed these.
4. **User input = full stop.** When you need the user's input — at a checkpoint, for a dirty tree, for a QUESTION from an agent, or for any other reason — output your question as plain text and **make zero tool calls in that response**. No Agent spawns, no Bash commands, no Read calls, nothing. Just the question text. Then wait for the user to type their reply. Parse their reply and continue. **Never assume a default answer. Never skip waiting for a reply.**
5. **Run quality gates yourself** — do not delegate test/coverage/typecheck commands to agents.
6. **If an agent writes a `QUESTION:` line in its output**, present that question to the user (see rule 4) and pass their answer to the next agent.

## Agents

Spawn each agent using the Agent tool with `subagent_type` set to the agent name below. Each agent has its own instructions, model, and tool restrictions defined in `.claude/agents/`.

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| `task-planner` | Sonnet | Read, Grep, Glob, Write | Creates implementation plans |
| `task-reviewer` | Opus | Read, Grep, Glob, Write | Reviews plans for correctness, security, HIPAA |
| `task-implementer` | Sonnet | Read, Write, Edit, Grep, Glob, Bash(git add/commit/diff/status/log) | Implements approved plans, commits code |
| `task-code-reviewer` | Opus | Read, Grep, Glob, Write, Bash(git diff/log/status/show) | Reviews code changes for bugs, security |
| `task-fixer` | Sonnet | Read, Write, Edit, Grep, Glob, Bash(git add/commit/diff/status/log) | Fixes quality gate failures and review issues |

---

## Pre-flight

Run these steps yourself (not delegated). **Each step is sequential — do NOT run the next step until the current step is fully resolved, including any user input.**

### Step 1: Get project root
```bash
git rev-parse --show-toplevel
```
Store as `PROJECT_ROOT`.

### Step 2: Check working tree
```bash
git status --porcelain
```
If the output is empty, the tree is clean — proceed to Step 3.

If the output is NOT empty (dirty tree), ask the user **(rule 4 — no tool calls, just text)**:

> Working tree has uncommitted changes. How should we proceed?
>
> 1. **Stash and continue** — I'll stash your changes and proceed
> 2. **Abort** — Stop the workflow
>
> Reply with 1 or 2.

**Wait for user reply. Do NOT proceed to Step 3.**

- **1 / Stash** → run `git stash push -m "implement-task: auto-stash"`, record that a stash was created, then proceed to Step 3.
- **2 / Abort** → stop the workflow entirely.

### Step 3: Check branch
```bash
git branch --show-current
```
Must be `main`. If not, STOP and tell the user to switch to main first.

### Step 4: Create workflow directory
```bash
ls .flashnote-workflow 2>/dev/null
```
If the command succeeds (directory exists — prior run artifacts found), ask the user **(rule 4)**:

> Found artifacts from a previous workflow run in `.flashnote-workflow/`. Delete them?
>
> 1. **Delete and continue** — Remove old artifacts and start fresh
> 2. **Abort** — Stop so I can inspect them
>
> Reply with 1 or 2.

**Wait for user reply. Do NOT proceed.**

- **1 / Delete** → run `rm -rf .flashnote-workflow`, then proceed.
- **2 / Abort** → stop the workflow.

If the directory does not exist, proceed directly.

Then create the directory:
```bash
mkdir -p .flashnote-workflow
```

### Step 5: Create feature branch
Derive a slug from the task description (lowercase, hyphens, max 50 chars):
```bash
git checkout -b feat/<slug>
```
Store as `FEATURE_BRANCH`.

---

## Phase 1: Planning

Spawn `task-planner` with prompt:

> Plan this task: $ARGUMENTS
>
> Write your plan to: `<PROJECT_ROOT>/.flashnote-workflow/plan.md`

Read `.flashnote-workflow/plan.md` when complete. Check for `QUESTION:` lines — if found, present each question to the user (rule 4), wait for their answers, then pass those answers to the planner in a revision prompt.

---

## Phase 2: Plan Review (3 rounds max)

### Round 1

Spawn `task-reviewer` with prompt:

> Review the plan at `<PROJECT_ROOT>/.flashnote-workflow/plan.md`.
>
> Write your review to: `<PROJECT_ROOT>/.flashnote-workflow/review-round-1.md`

Read `.flashnote-workflow/review-round-1.md`. Check for `QUESTION:` lines — if found, present to user (rule 4) and wait.

- **APPROVED** → proceed to Checkpoint 1.
- **NEEDS_REVISION** → continue below.

### Round 1 Revision (only if NEEDS_REVISION)

Spawn `task-planner` with prompt:

> Revise the plan at `<PROJECT_ROOT>/.flashnote-workflow/plan.md` based on the review at `<PROJECT_ROOT>/.flashnote-workflow/review-round-1.md`.
> Address all issues flagged. Write the revised plan to: `<PROJECT_ROOT>/.flashnote-workflow/plan-v2.md`

Then spawn `task-reviewer` for round 2:

> Review the revised plan at `<PROJECT_ROOT>/.flashnote-workflow/plan-v2.md` against the original feedback at `<PROJECT_ROOT>/.flashnote-workflow/review-round-1.md`.
> Verify all issues were addressed. Write to: `<PROJECT_ROOT>/.flashnote-workflow/review-round-2.md`

Read `.flashnote-workflow/review-round-2.md`.

- **APPROVED** → proceed to Checkpoint 1.
- **NEEDS_REVISION** → continue below.

### Round 2 Revision (only if NEEDS_REVISION)

Spawn `task-planner` with prompt:

> Revise the plan at `<PROJECT_ROOT>/.flashnote-workflow/plan-v2.md` based on the review at `<PROJECT_ROOT>/.flashnote-workflow/review-round-2.md`.
> Address all remaining issues. Write the revised plan to: `<PROJECT_ROOT>/.flashnote-workflow/plan-final.md`

Then spawn `task-reviewer` for round 3:

> Final review. Read the revised plan at `<PROJECT_ROOT>/.flashnote-workflow/plan-final.md` and all prior feedback at `<PROJECT_ROOT>/.flashnote-workflow/review-round-1.md` and `<PROJECT_ROOT>/.flashnote-workflow/review-round-2.md`.
> This is the final gate — verdict must be APPROVED or APPROVED_WITH_NOTES. Do NOT request another revision.
> Write to: `<PROJECT_ROOT>/.flashnote-workflow/review-round-3.md`

---

## ===== CHECKPOINT: Plan Approval =====

Determine the approved plan file: use the latest version — `plan-final.md` if it exists, otherwise `plan-v2.md` if it exists, otherwise `plan.md`. Track this as `PLAN_FILE` for the rest of the workflow.

Read `.flashnote-workflow/<PLAN_FILE>`. Then ask the user **(rule 4 — no tool calls, just this text)**:

> ## Plan Summary
>
> **Files:** [list files to modify/create]
>
> **Approach:** [2-3 sentence summary]
>
> **Reviewer notes:** [any risks or concerns, or "None"]
>
> ---
>
> The plan has been reviewed and approved. Ready to proceed?
>
> 1. **Proceed** — Implement according to the plan
> 2. **Abort** — Stop the workflow and clean up
> 3. **Provide feedback** — I want changes before implementation
>
> Reply with 1, 2, or 3. If choosing 3, include your feedback.

**Wait for user reply. Do NOT spawn agents or run commands.**

- **1 / Proceed** → Phase 3
- **2 / Abort** → Abort/Cleanup
- **3 / Feedback** → parse their feedback, spawn `task-planner` to revise, re-run review round 2, return to this checkpoint

---

## Phase 3: Implementation

Spawn `task-implementer` with prompt:

> Implement the plan at `<PROJECT_ROOT>/.flashnote-workflow/<PLAN_FILE>`.
>
> Write your summary to: `<PROJECT_ROOT>/.flashnote-workflow/implementation-summary.md`

Read `.flashnote-workflow/implementation-summary.md`. Check for `QUESTION:` lines — if found, present to user (rule 4) and wait.

---

## Quality Gate

Run yourself — do NOT delegate to agents.

1. Check for dependency changes:
   ```bash
   git diff main..HEAD --name-only
   ```
   If output contains `package.json` or `pnpm-lock.yaml`, run:
   ```bash
   pnpm --filter web install --frozen-lockfile
   ```

2. Run tests:
   ```bash
   pnpm --filter web test:ci
   ```

3. Type check:
   ```bash
   pnpm --filter web exec tsc --noEmit
   ```

4. Lint:
   ```bash
   pnpm --filter web lint
   ```

All must pass: tests green, 95%+ coverage, zero TS errors, zero lint errors.

**If any check fails:** Spawn `task-fixer` with prompt:

> Quality gate failed. Fix the issues below.
>
> [paste the failing output verbatim]
>
> Write summary to: `<PROJECT_ROOT>/.flashnote-workflow/fix-summary.md`

After the fixer returns, **re-run ALL quality gate checks**. Max 2 fix attempts total — if still failing, stop and report to user.

---

## Phase 4: Code Review (3 rounds max)

### Round 1

Spawn `task-code-reviewer` with prompt:

> Review the code changes on this branch.
> Implementation context: `<PROJECT_ROOT>/.flashnote-workflow/implementation-summary.md`
>
> Write your review to: `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-1.md`

Read `.flashnote-workflow/code-review-round-1.md`.

- **CODE_APPROVED** → proceed to Deep Dive Offer.
- **CHANGES_REQUESTED** → continue below.

### Round 1 Fixes (only if CHANGES_REQUESTED)

Spawn `task-fixer` with prompt:

> Fix the issues in `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-1.md`.
>
> Write summary to: `<PROJECT_ROOT>/.flashnote-workflow/fixes-round-1-summary.md`

Re-run the Quality Gate (all 4 checks).

Then spawn `task-code-reviewer` for round 2:

> Review the code changes. Read original issues at `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-1.md` and fixes at `<PROJECT_ROOT>/.flashnote-workflow/fixes-round-1-summary.md`.
> Verify via `git diff main..HEAD`.
> Write to: `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-2.md`

Read `.flashnote-workflow/code-review-round-2.md`.

- **CODE_APPROVED** → proceed to Deep Dive Offer.
- **CHANGES_REQUESTED** → continue below.

### Round 2 Fixes (only if CHANGES_REQUESTED)

Spawn `task-fixer` with prompt:

> Fix the issues in `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-2.md`.
>
> Write summary to: `<PROJECT_ROOT>/.flashnote-workflow/fixes-round-2-summary.md`

Re-run the Quality Gate (all 4 checks).

Then spawn `task-code-reviewer` for round 3:

> Final review. Read all prior issues at `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-1.md` and `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-2.md`, and latest fixes at `<PROJECT_ROOT>/.flashnote-workflow/fixes-round-2-summary.md`.
> Verify via `git diff main..HEAD`.
> This is the final gate — verdict must be CODE_APPROVED or CODE_APPROVED_WITH_NOTES. Do NOT request another round.
> Write to: `<PROJECT_ROOT>/.flashnote-workflow/code-review-round-3.md`

---

## Deep Dive Offer

After code review approval, ask the user **(rule 4 — no tool calls, just this text)**:

> Code review complete. Would you like a deep-dive local review before pushing?
>
> The deep dive uses the `local-review` skill — a more aggressive, multi-agent review that checks CLAUDE.md compliance, bugs, security (OWASP top 10), type safety, and code simplification across all changes.
>
> 1. **Skip** — Proceed to Pre-Push Review
> 2. **Deep dive** — Run local-review before pushing
>
> Reply with 1 or 2.

**Wait for user reply. Do NOT proceed.**

- **1 / Skip** → proceed to Checkpoint 2 (Pre-Push Review).
- **2 / Deep dive** → run the `local-review:local-review` skill using the Skill tool. After it completes:
  - If it reports **Critical** issues: spawn `task-fixer` with the critical issues, re-run the Quality Gate, then proceed to Checkpoint 2.
  - If it reports **Warning** or **Simplification** issues only: present the findings to the user and ask whether to fix them or proceed as-is.
  - If it reports no significant issues: proceed to Checkpoint 2.

---

## ===== CHECKPOINT: Pre-Push Review =====

Run `git diff --stat main..HEAD`. Read the implementation summary and latest code review.

Then ask the user **(rule 4 — no tool calls, just this text)**:

> ## Pre-Push Summary
>
> **Files changed:**
> [paste diff stat]
>
> **What was implemented:** [brief summary]
>
> **Code review:** [APPROVED / APPROVED_WITH_NOTES + any notes]
>
> **Quality gate:** All checks passing
>
> **Branch:** `FEATURE_BRANCH`
>
> ---
>
> Ready to push and create a PR?
>
> 1. **Proceed** — Push and create a pull request
> 2. **Abort** — Discard the feature branch and clean up
> 3. **Request changes** — I want fixes before pushing
>
> Reply with 1, 2, or 3. If choosing 3, include what you want changed.

**Wait for user reply. Do NOT proceed.**

- **1 / Proceed** → Phase 5
- **2 / Abort** → Abort/Cleanup
- **3 / Request changes** → parse their notes, spawn `task-fixer`, re-run quality gate, return to this checkpoint

---

## Phase 5: Push and PR

1. Update `docs/ROADMAP.md` — use the Edit tool to mark the relevant task complete. Then stage and commit:
   ```bash
   git add docs/ROADMAP.md
   ```
   ```bash
   git commit -m "docs: mark task complete in ROADMAP"
   ```

2. Push:
   ```bash
   git push -u origin <FEATURE_BRANCH>
   ```

3. Create PR using `gh pr create` with a thorough description and smoke testing plan. Use the template below.

### PR Title

Conventional Commits format: `<type>(<scope>): <short imperative description>` (under 70 chars).

### PR Body

Use a HEREDOC to pass the body to `gh pr create`:

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary

<1-3 sentences: what this PR does and why. Reference the task description.>

## Changes

<Group changes logically. Explain design decisions and anything non-obvious.>

- **<Area>**: <what changed and why>
- **<Area>**: <what changed and why>

## Smoke Testing

<Smoke tests are MANUAL verification steps that a reviewer runs locally against a running application — not unit test commands. The reviewer should start the app, interact with it (via browser, curl, CLI, etc.), and confirm the change works end-to-end.>

<IMPORTANT: Do NOT write smoke test scenarios that just run unit tests (e.g., `pnpm test -- --grep "..."`). Those belong in the "Automated Tests" section at the bottom, not in smoke testing. Smoke tests verify real behavior by interacting with the running application.>

<If the change is purely internal (e.g., a refactor, test-only change, or infrastructure change with no observable behavior), state this explicitly: "This change has no user-facing behavior to smoke test. Verification is limited to automated tests below." Do not fabricate smoke test scenarios that are actually unit test commands.>

### Prerequisites

<Any setup needed before testing — local server running, database seeded, environment variables, test accounts, etc.>

```bash
pnpm --filter web install
pnpm --filter web dev
```

### Test Scenarios

#### Scenario 1: <Happy path — the main thing this PR enables>

- [ ] **Step 1:** <Concrete step — a URL to visit, a button to click, a curl command to run against localhost>
- [ ] **Step 2:** <Next step>
- [ ] **Step 3:** <Verify expected result>

**Expected result:** <What the reviewer should see in their browser, terminal, or network tab>

#### Scenario 2: <Edge case or error handling>

- [ ] **Step 1:** <Steps to trigger the edge case against the running app>
- [ ] **Step 2:** <Verify expected result>

**Expected result:** <What should happen — graceful error, fallback, correct UI state, etc.>

#### Scenario 3: <Regression check — make sure nothing broke>

- [ ] **Step 1:** <Steps to verify existing functionality still works in the running app>
- [ ] **Step 2:** <Verify expected result>

**Expected result:** <Same behavior as before this PR>

### Automated Tests

```bash
pnpm --filter web test:ci
pnpm --filter web exec tsc --noEmit
pnpm --filter web lint
```

<Note which tests are new vs. existing, and what they cover. This is where unit/integration test commands belong — NOT in the smoke testing scenarios above.>

## Code Review

<Summarize the code review verdict and any reviewer notes from Phase 4.>

## Notes for Reviewers

<Optional: areas of uncertainty, follow-up work, known limitations.>
EOF
)"
```

**Smoke testing guidelines:**
- **Smoke tests are manual, local verification against a running app.** The reviewer should start the dev server, open a browser or run curl, and interact with the actual application. Smoke tests are NOT unit test commands — those belong in "Automated Tests."
- **If there's nothing to smoke test, say so.** Some changes (pure refactors, test-only changes, internal plumbing) have no observable behavior to verify manually. Write: "This change has no user-facing behavior to smoke test. Verification is limited to automated tests below." Do not disguise unit test commands as smoke test scenarios.
- **Use checkboxes.** Every smoke test step should be a checkbox (`- [ ]`) so the reviewer can track progress.
- **Copy-paste ready**: Every command should be runnable as-is. No placeholders like `<your-token-here>` without explaining how to get the value.
- **Include expected output**: Don't say "it should work" — show what success looks like (UI state, terminal output, HTTP response).
- **Cover the triad**: happy path, edge/error case, regression. These three catch the vast majority of issues.
- **Healthcare context**: If the change touches auth, session handling, or data access, include a scenario verifying that unauthenticated/unauthorized access is properly denied.
- **Adapt to the stack**: Backend → curl commands. Frontend → describe clicks and visual results. DAL → reference the test output. For library/internal changes, show a minimal usage example or state that smoke testing is N/A.

4. **Report the PR URL to the user.**

5. Clean up:
   ```bash
   rm -rf .flashnote-workflow
   ```

---

## Abort/Cleanup

When the user chooses "Abort", ask **(rule 4)**:

> How should the feature branch be handled?
>
> 1. **Delete branch** — Discard all work
> 2. **Keep branch** — Switch to main but keep `FEATURE_BRANCH` for inspection
>
> Reply with 1 or 2.

**Wait for user reply.**

Then run:

```bash
git checkout -f main
```

If user chose 1 (Delete):
```bash
git branch -D <FEATURE_BRANCH>
```

If user chose 2 (Keep), tell them: "Branch `<FEATURE_BRANCH>` preserved. Last commit: `<SHA>`."

```bash
rm -rf .flashnote-workflow
```

If a stash was created during pre-flight:
```bash
git stash pop
```
If `git stash pop` fails (conflict), tell the user: "Stash could not be applied cleanly. Your changes are still in the stash — use `git stash list` to find them and `git stash apply stash@{N}` to retry."

---

## Failure Handling

| Situation | Action |
|---|---|
| Agent output looks fundamentally wrong | Stop, report to user |
| Agent writes `QUESTION:` lines | Present question to user (rule 4), wait for reply, pass answer to next agent |
| Quality gate fails after 2 fix attempts | Stop, report failing output to user |
| Critical security issues unfixed after round 3 | Stop, report to user |
| `gh pr create` fails | Report error, leave branch pushed for manual PR |
| Workflow aborted at any checkpoint | Run Abort/Cleanup |
