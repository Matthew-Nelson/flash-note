---
description: Multi-agent workflow — plan, review, implement, code review, and PR
allowed-tools: Agent, Read, Edit, Grep, Bash(git:*), Bash(gh:*), Bash(pnpm:*), Bash(mkdir:*), Bash(rm:*), Bash(ls:*), AskUserQuestion
---

Execute a multi-agent implementation workflow for the following task:

**Task:** $ARGUMENTS

---

## Instructions

You are an orchestrator. Coordinate specialized agents through 5 phases. Follow these rules exactly:

1. **Do not implement anything yourself.** Delegate all code changes to agents.
2. **Read every agent output file before spawning the next agent.** Verify the output makes sense. If it looks wrong, stop and report to the user.
3. **Enforce iteration limits.** Plan review: 2 rounds max. Code review: 2 rounds max. Never exceed these.
4. **Every AskUserQuestion is a hard stop.** After calling AskUserQuestion, do NOT call any other tools, spawn agents, or run commands until you have received the user's actual response. This applies everywhere — pre-flight, checkpoints, QUESTION handling. Never assume a default answer.
5. **Run quality gates yourself** — do not delegate test/coverage/typecheck commands to agents.
6. **If an agent writes a `QUESTION:` line in its output**, stop and ask the user that question via AskUserQuestion before continuing.

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

Run these steps yourself (not delegated). **Each step is sequential — do NOT run the next step until the current step is fully resolved, including any user questions.**

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

If the output is NOT empty (dirty tree), call AskUserQuestion:
- question: "Working tree has uncommitted changes. How should we proceed?"
- header: "Dirty tree"
- multiSelect: false
- options:
  1. "Stash and continue" — Stash changes and proceed with the workflow
  2. "Abort" — Stop the workflow

**STOP. Do NOT proceed to Step 3 until the user responds.**

- **Stash and continue** → run `git stash push -m "implement-task: auto-stash"`, record that a stash was created, then proceed to Step 3.
- **Abort** → stop the workflow entirely.

### Step 3: Check branch
```bash
git branch --show-current
```
Must be `main`. If not, STOP and tell the user to switch to main first.

### Step 4: Create workflow directory
```bash
ls .claude/workflow 2>/dev/null
```
If the command succeeds (directory exists — prior run artifacts found), call AskUserQuestion:
- question: "Found artifacts from a previous workflow run in .claude/workflow/. Delete them?"
- header: "Prior run"
- multiSelect: false
- options:
  1. "Delete and continue" — Remove old artifacts and start fresh
  2. "Abort" — Stop so I can inspect the artifacts

**STOP. Do NOT proceed until the user responds.**

- **Delete and continue** → run `rm -rf .claude/workflow`, then proceed.
- **Abort** → stop the workflow.

Then create the directory:
```bash
mkdir -p .claude/workflow
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
> Write your plan to: `<PROJECT_ROOT>/.claude/workflow/plan.md`

Read `.claude/workflow/plan.md` when complete. Check for `QUESTION:` lines.

---

## Phase 2: Plan Review (2 rounds max)

### Round 1

Spawn `task-reviewer` with prompt:

> Review the plan at `<PROJECT_ROOT>/.claude/workflow/plan.md`.
>
> Write your review to: `<PROJECT_ROOT>/.claude/workflow/review-round-1.md`

Read `.claude/workflow/review-round-1.md`. Check for `QUESTION:` lines.

- **APPROVED** → proceed to Checkpoint 1.
- **NEEDS_REVISION** → continue below.

### Revision (only if NEEDS_REVISION)

Spawn `task-planner` with prompt:

> Revise the plan at `<PROJECT_ROOT>/.claude/workflow/plan.md` based on the review at `<PROJECT_ROOT>/.claude/workflow/review-round-1.md`.
> Address all issues flagged. Write the revised plan to: `<PROJECT_ROOT>/.claude/workflow/plan-final.md`

Then spawn `task-reviewer` for round 2:

> Final review. Read the revised plan at `<PROJECT_ROOT>/.claude/workflow/plan-final.md` and the original feedback at `<PROJECT_ROOT>/.claude/workflow/review-round-1.md`.
> This is the final gate — verdict must be APPROVED or APPROVED_WITH_NOTES. Do NOT request another revision.
> Write to: `<PROJECT_ROOT>/.claude/workflow/review-round-2.md`

---

## ===== CHECKPOINT: Plan Approval =====

Determine the approved plan file: use `plan-final.md` if it exists, otherwise `plan.md`. Track this as `PLAN_FILE` for the rest of the workflow.

Read `.claude/workflow/<PLAN_FILE>`. Present a summary:
- Files to be modified/created
- Core approach (2-3 sentences)
- Risks or reviewer notes

**Immediately** call AskUserQuestion:
- question: "The plan has been reviewed and approved. Ready to proceed with implementation?"
- header: "Plan"
- multiSelect: false
- options:
  1. "Proceed" — Implement according to the approved plan
  2. "Abort" — Stop the workflow and clean up
  3. "Provide feedback" — I want changes before implementation

**STOP. Do NOT spawn agents, run commands, or do any work until the user responds.**

- **Proceed** → Phase 3
- **Abort** → Abort/Cleanup
- **Provide feedback** → get notes, spawn `task-planner` to revise, re-run review round 2, return to this checkpoint

---

## Phase 3: Implementation

Spawn `task-implementer` with prompt:

> Implement the plan at `<PROJECT_ROOT>/.claude/workflow/<PLAN_FILE>`.
>
> Write your summary to: `<PROJECT_ROOT>/.claude/workflow/implementation-summary.md`

Read `.claude/workflow/implementation-summary.md`. Check for `QUESTION:` lines.

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
> Write summary to: `<PROJECT_ROOT>/.claude/workflow/fix-summary.md`

After the fixer returns, **re-run ALL quality gate checks**. Max 2 fix attempts total — if still failing, stop and report to user.

---

## Phase 4: Code Review (2 rounds max)

### Round 1

Spawn `task-code-reviewer` with prompt:

> Review the code changes on this branch.
> Implementation context: `<PROJECT_ROOT>/.claude/workflow/implementation-summary.md`
>
> Write your review to: `<PROJECT_ROOT>/.claude/workflow/code-review-round-1.md`

Read `.claude/workflow/code-review-round-1.md`.

- **CODE_APPROVED** → proceed to Checkpoint 2.
- **CHANGES_REQUESTED** → continue below.

### Fixes (only if CHANGES_REQUESTED)

Spawn `task-fixer` with prompt:

> Fix the issues in `<PROJECT_ROOT>/.claude/workflow/code-review-round-1.md`.
>
> Write summary to: `<PROJECT_ROOT>/.claude/workflow/fixes-summary.md`

Re-run the Quality Gate (all 4 checks).

Then spawn `task-code-reviewer` for round 2:

> Final review. Read original issues at `<PROJECT_ROOT>/.claude/workflow/code-review-round-1.md` and fixes at `<PROJECT_ROOT>/.claude/workflow/fixes-summary.md`.
> Verify via `git diff main..HEAD`.
> This is the final gate — verdict must be CODE_APPROVED or CODE_APPROVED_WITH_NOTES. Do NOT request another round.
> Write to: `<PROJECT_ROOT>/.claude/workflow/code-review-round-2.md`

---

## ===== CHECKPOINT: Pre-Push Review =====

Run `git diff --stat main..HEAD`. Read the implementation summary and latest code review.

Present:
- Files changed (diff stat)
- What was implemented
- Code review result
- Quality gate status
- Branch name: `FEATURE_BRANCH`

**Immediately** call AskUserQuestion:
- question: "Implementation complete and all checks pass. Ready to push and create a PR?"
- header: "Pre-Push"
- multiSelect: false
- options:
  1. "Proceed" — Push and create a pull request
  2. "Abort" — Discard the feature branch and clean up
  3. "Request changes" — I want fixes before pushing

**STOP. Do NOT proceed until the user responds.**

- **Proceed** → Phase 5
- **Abort** → Abort/Cleanup
- **Request changes** → get notes, spawn `task-fixer`, re-run quality gate, return to this checkpoint

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

3. Create PR using `gh pr create`. Include a summary of what changed, the approach taken, code review notes, and a test plan. Keep the title under 70 chars.

4. **Report the PR URL to the user.**

5. Clean up:
   ```bash
   rm -rf .claude/workflow
   ```

---

## Abort/Cleanup

When the user chooses "Abort", AskUserQuestion:
- question: "How should the feature branch be handled?"
- header: "Cleanup"
- multiSelect: false
- options:
  1. "Delete branch" — Discard all work on the feature branch
  2. "Keep branch" — Switch to main but keep the feature branch for inspection

Then run:

```bash
git checkout -f main
```

If user chose "Delete branch":
```bash
git branch -D <FEATURE_BRANCH>
```

If user chose "Keep branch", tell them: "Branch `<FEATURE_BRANCH>` preserved. Last commit: `<SHA>`."

```bash
rm -rf .claude/workflow
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
| Agent writes `QUESTION:` lines | Stop, ask user via AskUserQuestion, pass answer to next agent |
| Quality gate fails after 2 fix attempts | Stop, report failing output to user |
| Critical security issues unfixed after round 2 | Stop, report to user |
| `gh pr create` fails | Report error, leave branch pushed for manual PR |
| Workflow aborted at any checkpoint | Run Abort/Cleanup |
