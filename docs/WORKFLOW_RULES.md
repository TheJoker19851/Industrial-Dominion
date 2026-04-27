# WORKFLOW_RULES.md

## Execution pipeline (mandatory)

1. Plan
2. Code
3. Review

---

## Plan (mandatory)

- Explain intent and scope before coding.
- Identify impacted files and dependencies.
- Explicitly list reused systems (slippage, arbitrage, decision, etc.)
- State tests/checks to run.
- Confirm no duplication of existing logic.

---

## Code (mandatory)

- Max 3–5 files modified per step unless explicitly justified.
- No large uncontrolled refactors.
- No architecture or stack changes without explicit approval.
- No unrelated improvements or speculative expansions.
- MUST NOT start coding if CURRENT_TASK is not explicitly defined
- MUST NOT modify shared economic logic unless the current task explicitly requires it

### Critical Constraints (Industrial Dominion)

- NEVER duplicate economic logic:
  - Must reuse:
    - slippage (TASK-055)
    - arbitrage (TASK-056)
    - decision engine (TASK-057)

- Frontend MUST NOT compute economics:
  - UI only consumes API/shared outputs

- All calculations MUST remain:
  - deterministic
  - stateless
  - explainable

- Maintain strict separation:
  - shared = pure logic
  - api = orchestration
  - web = UI only

---

## Review (mandatory)

- Summarize changes after implementation.
- Confirm acceptance criteria.
- Note risks, gaps, and follow-ups.
- Confirm:
  - no duplicated logic introduced
  - no architectural drift
- Update CURRENT_TASK and TASK_BACKLOG.
- Update JOURNAL when work is completed.
- If Autonomous Mode is enabled:
  - Continue to the next READY task automatically
- Otherwise:
  - Stop after the summary unless explicitly asked to continue

---

## Safeguards against agent drift

- Prevent over-engineering: choose minimal viable change.
- Prevent unnecessary file edits: change only impacted files.
- Prevent architecture drift: reuse existing patterns.
- Prevent scope creep: only backlog-defined work.

### Economic Safety Rules (CRITICAL)

- Do NOT invent new pricing logic
- Do NOT bypass slippage/arbitrage systems
- Do NOT simplify calculations for convenience
- Do NOT hardcode "best strategy" logic

---

## Stop conditions

STOP immediately if:

- Missing requirements, secrets, or approvals
- Task scope unclear after reading core docs
- Required tests fail and no safe fix exists
- File limit exceeded without justification
- A new economic rule seems required
- A system must be bypassed to make code work
- CURRENT_TASK.md is missing or unclear

Explain instead of guessing.

---

## Autonomous loop (only when explicitly requested)

1. Select first READY task with satisfied dependencies
2. Copy it into CURRENT_TASK.md
3. Execute Plan → Code → Review
4. Run relevant checks/tests
5. Mark task done in TASK_BACKLOG.md
6. Update CURRENT_TASK.md and JOURNAL
7. If Autonomous Mode is enabled and the maximum consecutive task limit is not reached:
   - move to the next READY task whose dependencies are satisfied
8. Otherwise:
   - stop with a concise summary

---

## Autonomous Safety Limit

- Maximum 4 consecutive tasks per session
- After 4 tasks → HARD STOP (no continuation allowed)
- Never unlock blocked/later tasks automatically
- Never continue if task dependencies are not satisfied
- Never continue if scope or architecture becomes unclear
