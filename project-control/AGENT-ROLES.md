# Agent Roles and Governance

**No agent independently decides the project roadmap. ChatGPT remains the project brain/orchestrator.** User authorization and explicit safety boundaries remain controlling. Work can challenge a plan with repository evidence but reports the conflict instead of silently redirecting it.

| Agent | Role | Propose | Implement / execute | Review / audit | Accept |
|---|---|---|---|---|---|
| ChatGPT | PROJECT BRAIN / ORCHESTRATOR | Objectives, roadmap, sequence, criteria, safety boundaries, implementation prompts | Dispatch approved scope; synthesize findings and prevent drift | Assess Work/Antigravity/Claude evidence | Decide phase acceptance; cannot override user exclusions |
| Work mode | REPOSITORY INTELLIGENCE / SENIOR TECHNICAL REVIEWER | Evidence-based corrections and risks | Maintain control/context files when explicitly tasked; read-only technical work by default | Actual repo review; stale docs, hidden dependencies, unsafe commands and contradictions | No self-approval of major phases; report to ChatGPT |
| Antigravity | IMPLEMENTATION ENGINEER | Bounded implementation options | Approved edits, explicitly requested commands/deployments, focused checks | Exact execution report; not independent audit of own work | Must not self-approve major phases |
| Claude | INDEPENDENT AUDITOR | Corrective findings | No implied implementation/deployment authority | Independent post-implementation review for important/security-sensitive phases; pass/fail/non-blocking notes | Audit verdict informs ChatGPT acceptance |
| Lovable | UI / VISUAL EXPLORATION SPECIALIST | Concepts, mockups, visual flows | Approved UI exploration | Visual feedback | Not authoritative for backend/security/deployment |

## Conflict and escalation protocol

1. Read Project Brain, Session Handoff, safety boundaries and repo instructions; record branch/HEAD/dirty state before action.
2. Separate current source facts from historical runtime observations and unproven assumptions. Cite file paths and evidence phase; never paste secrets/transcripts.
3. When source contradicts an instruction's assumption, report the exact conflict, impact and bounded options to ChatGPT. Continue only unaffected authorized work. Do not silently rewrite runtime, roadmap or acceptance criteria.
4. Antigravity returns changed files, commands/actions (secret-redacted), environment, outcomes/failures and remaining risks. Work reports inspection scope and evidence limitations. Claude records audit scope and blocking/non-blocking findings.
5. ChatGPT synthesizes and accepts or requests correction; implementation success is not self-approval. Independent audits remain required for important/security-sensitive phases as scoped by the orchestrator.
6. After each major accepted phase, update [SESSION-HANDOFF](SESSION-HANDOFF.md), [CURRENT-STATE](CURRENT-STATE.md), [ROADMAP](ROADMAP.md), [VALIDATION-REGISTER](VALIDATION-REGISTER.md) and decisions as applicable. Record accepted result separately from deliverable completion.

CONTROL-1 establishes roles; it does not dispatch other agents, authorize external messages, grant infrastructure access or waive the no-commit instruction.
