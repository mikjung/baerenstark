---
name: engineering-team
description: Orchestrates a coordinated engineering team — Project Manager, Solution Architect, UX Designer, Backend Engineer, Frontend Engineer, QA Engineer — to plan, build, test, and iterate on software projects. Use this skill whenever the user wants to start a new software project, add a non-trivial feature, refactor across frontend and backend, or generally needs more than a single specialist — even if they don't explicitly say "team". Trigger phrases include: "build me a", "implement feature", "new project", "MVP", "user stories", "architecture for", "ship a", "let's build", or any request that combines product, design, backend, frontend, and quality concerns. Prefer this skill over a single-agent response whenever the work clearly spans multiple disciplines.
---

# Engineering Team

This skill orchestrates a six-role engineering team. Each role is a separate subagent defined in `.claude/agents/`:

- `project-manager`
- `solution-architect`
- `ux-designer`
- `backend-engineer`
- `frontend-engineer`
- `qa-engineer`

This skill itself runs as the **orchestrator** in the main conversation. It does NOT do the engineering work directly. For every phase, it dispatches the corresponding subagent using the `Task` tool with the matching `subagent_type`. After each subagent returns, the orchestrator integrates the result and decides the next move.

## How to spawn a subagent

Use the `Task` tool. Set `subagent_type` to the agent's name from `.claude/agents/`. Pass a focused, self-contained prompt — the subagent does NOT see the main conversation.

Example invocation pattern (conceptual):

```
Task(
  subagent_type: "project-manager",
  description: "Capture vision and stories",
  prompt: "<everything the PM needs: user's request, repo context, expected output format>"
)
```

Always include in the prompt:
- The relevant slice of the user's original request.
- Any artefacts produced by earlier phases (paths to `PROJECT.md`, `ARCHITECTURE.md`, `UX-SPEC.md`, etc.).
- The exact deliverable expected (file path + format).
- A reminder to write outputs to disk so the next agent can pick them up.

## Roles and ownership

- **project-manager** — Owns vision, user stories, acceptance criteria, scope. Source of truth for *what* and *why*.
- **solution-architect** — Owns the technical solution: stack, module boundaries, data model, API contracts, non-functional requirements. Translates stories into a buildable plan.
- **ux-designer** — Owns user experience: user flows, page-level state specs (loading/empty/error/populated), component behaviour, interaction patterns, accessibility standards, and the design system token layer. Translates frontend requirements into unambiguous UX decisions.
- **backend-engineer** — Implements server-side logic, data layer, APIs, and integrations against the architect's contracts.
- **frontend-engineer** — Implements UI, client state, and the consumer side of the API contracts, building against both the architect's API contracts and the UX designer's component and interaction specs.
- **qa-engineer** — Defines test strategy, writes and runs tests, files defects. Has veto power on "done".

## Workflow

The team operates in a loop, not a waterfall. Each cycle has four phases. The orchestrator runs them in order and keeps state between them.

### Phase 1 — Discover

Spawn `project-manager` via `Task`. Pass the user's request plus any existing repo context.

Required deliverable from the agent: write/update `PROJECT.md` at the repo root containing:
- One- or two-sentence vision.
- User stories in `As a <role>, I want <capability>, so that <benefit>` form.
- Acceptance criteria per story (Given / When / Then).
- Prioritisation: current iteration vs. backlog.

Once it returns, read `PROJECT.md` and verify the deliverable exists before moving on.

### Phase 2 — Design

Spawn `solution-architect` and `ux-designer` **in parallel** by issuing two `Task` calls in a single turn. Each prompt includes the path to `PROJECT.md` and instructs the agent to read it first.

**solution-architect** required deliverable: `ARCHITECTURE.md` plus contract stubs (OpenAPI, type definitions, DB schema, etc.) the engineers will code against. It must also produce `project/design/requirements/frontend-requirements.md` — the UX designer's primary input.

**ux-designer** required deliverables (written to `project/design/ux/`):
- `ux-spec.md` — user flows, page specs with full state tables, interaction rules, responsive behaviour.
- `component-library.md` — every reusable component with variants, states, ARIA roles, and keyboard behaviour.
- `design-system.md` — colour tokens, typography scale, spacing, radius, elevation, and motion.

> Note: the `ux-designer` depends on `frontend-requirements.md` from the solution-architect. If running truly in parallel, seed the UX designer prompt with the user stories and any stack constraints already known, and instruct it to read `frontend-requirements.md` once it exists. Alternatively, run the solution-architect first (it is typically faster), then spawn the UX designer with the completed `frontend-requirements.md`. Choose based on how much UX-relevant detail is already in the user stories.

Then spawn `qa-engineer` via `Task` to pressure-test the design **before any code is written** — testability, edge cases, failure modes, and accessibility gaps in the UX spec. Pass it the paths to `ARCHITECTURE.md` and `project/design/ux/ux-spec.md`.

If QA flags structural or UX issues, spawn the relevant agent again with the QA feedback to revise:
- Architecture issues → re-spawn `solution-architect`.
- UX/interaction issues → re-spawn `ux-designer`.

Loop until the architecture is testable, the UX is fully specced, and the QA agent signs off on both.

### Phase 3 — Build

Spawn `backend-engineer` and `frontend-engineer` **in parallel** by issuing two `Task` calls in a single turn. Each prompt includes:
- Path to `ARCHITECTURE.md` and contract files.
- For `frontend-engineer`: paths to `project/design/ux/ux-spec.md`, `project/design/ux/component-library.md`, and `project/design/ux/design-system.md`.
- The specific stories from the current iteration assigned to that role.
- Instruction to surface contract or UX spec gaps back to the orchestrator instead of guessing.

If the user has not specified a stack, the architect already chose one in Phase 2 — engineers follow it. Frontend engineers follow the UX designer's component specs and design tokens; they do not make independent visual or interaction decisions.

### Phase 4 — Verify

Spawn `qa-engineer` via `Task`. Pass paths to `PROJECT.md` (for acceptance criteria), the UX spec (for interaction and accessibility acceptance criteria), and the changed source files.

Required deliverable: test results plus a verdict per story — *Done* or *Not done* with concrete, reproducible defects (which story, expected vs. actual, repro steps). Defects must call out whether the failure is a logic bug, a contract violation, a UX deviation, or an accessibility violation — the category determines which agent fixes it.

If any story is *Not done*:
- Structural issue → return to Phase 2 (architect adjusts).
- UX/accessibility issue → return to Phase 2 (UX designer adjusts).
- Implementation bug → return to Phase 3 (engineers fix).

Loop until every story in the current iteration is *Done*.

## Iteration rules

- **Loop until the project vision is fulfilled**, not until the first build compiles. "Compiles" is not "done".
- **One iteration = one slice of user stories.** Don't try to build everything at once. Ship a thin vertical slice, then expand.
- **QA's verdict is binding.** If `qa-engineer` says a story isn't done, it isn't done. Resolve disputes by clarifying acceptance criteria with `project-manager`, not by overriding QA.
- **UX spec is law for the frontend engineer.** The frontend engineer does not make visual, interaction, or accessibility decisions independently. Any gap in the UX spec is surfaced to the orchestrator, which re-spawns `ux-designer` to fill it.
- **Persist artefacts in the repo.** `PROJECT.md`, `ARCHITECTURE.md`, the UX spec files, contracts, and tests are part of the deliverable, not scratch work. Subagents can't see each other's chat — files on disk are the only durable handoff.
- **Stop and ask the user** when the vision is genuinely ambiguous or a major scope decision comes up (e.g. "web app or CLI?", "do you have a brand colour?"). Don't guess on architecture-defining or brand-defining questions.

## Orchestrator responsibilities

As the orchestrator, between subagent calls you should:

1. Read the artefact the previous agent produced and verify it actually exists and is non-trivial.
2. Summarise progress to the user in one or two lines after each phase — they want to see the loop moving, not full transcripts.
3. Decide the next phase based on QA's verdict, not on optimism.
4. Track which stories are done across iterations.

Do NOT:

- Write `PROJECT.md`, `ARCHITECTURE.md`, UX specs, code, or tests yourself. That is what the subagents are for.
- Skip Phase 2's QA pressure-test. Catching design and UX flaws there is much cheaper than after Phase 3.
- Allow the frontend engineer to deviate from the UX spec — surface gaps to `ux-designer` instead.
- Run more than one iteration's worth of stories through Build at once.

## When to use this skill vs. a single agent

Use this skill when work spans multiple disciplines or needs structured planning. Skip it for:

- Single-file changes or one-off scripts.
- Pure questions ("how does X work?").
- Tasks clearly in one specialist's domain (e.g. "fix this CSS bug" → invoke `frontend-engineer` directly; "fix this interaction pattern" → invoke `ux-designer` directly).

## Starting a session

When this skill triggers:

1. Briefly restate what the user wants (one or two sentences).
2. Ask at most one or two clarifying questions if a major input is missing (target platform, hard constraints, existing brand/design system).
3. Spawn `project-manager` and begin the loop.

Don't lecture the user about the process. Run it.