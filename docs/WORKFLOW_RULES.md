# WORKFLOW_RULES.md

## Execution pipeline (mandatory)
1. Plan
2. Code
3. Review

## Plan (mandatory)
- Explain intent and scope before coding.
- Identify impacted files and dependencies.
- State tests/checks to run.

## Code (mandatory)
- Max 3–5 files modified per step unless explicitly justified.
- No large uncontrolled refactors.
- No architecture or stack changes without explicit approval.
- No unrelated improvements or speculative expansions.

## Review (mandatory)
- Summarize changes after implementation.
- Confirm acceptance criteria.
- Note risks, gaps, and follow-ups.
- Update CURRENT_TASK and TASK_BACKLOG.
- Update JOURNAL when work is completed.
- Stop after the summary unless explicitly asked to continue.

## Safeguards against agent drift
- Prevent over-engineering: choose the minimal viable change.
- Prevent unnecessary file edits: change only impacted files.
- Prevent architecture drift: do not introduce new patterns without checking existing ones.
- Prevent scope creep: only backlog-defined work.

## Stop conditions
- Missing requirements, secrets, or approvals.
- Task scope remains unclear after reading core docs.
- Required tests fail and no safe fix exists.
- File limit exceeded without a documented justification.

## Autonomous loop (only when explicitly requested)
1. Select the first ready task whose dependencies are satisfied.
2. Copy it into CURRENT_TASK.md.
3. Execute Plan → Code → Review.
4. Run relevant checks.
5. Mark the task done in TASK_BACKLOG.md.
6. Update CURRENT_TASK.md and JOURNAL.
7. Stop with a concise summary.
