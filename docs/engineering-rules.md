# Engineering Rules

Production-quality, senior-engineer code: **correct, maintainable, modular, performant, and simple**. Optimize for correctness and long-term maintainability—not diff size, abstraction count, or feature count.

These rules apply to every AI-assisted code change. AI agents must read this file at the start of work, apply the review rubric while coding, run `npm run validate`, and report any remaining limitation. The root `AGENTS.md` and `CLAUDE.md` point agents here; `npm run guardrails` enforces file placement and import direction. GitHub Actions runs the same validation on pushes and pull requests. A later cleanup run should find no avoidable structural drift.

## 1. Before Coding

1. Understand the request and existing architecture.
2. Inspect relevant files, patterns, dependencies, and project rules.
3. Search before creating anything new.
4. Identify the **smallest correct change**.
5. Define verifiable success criteria.
6. Ask when requirements are genuinely ambiguous; never guess.
7. Verify framework/library behavior when uncertain.

Do not redesign stable architecture without a concrete reason.

## 2. Change Discipline

* Make surgical, behavior-preserving changes.
* Reuse existing components, hooks, services, utilities, and design tokens.
* One source of truth; no duplicate implementations.
* Remove obsolete code created by the change.
* No speculative features, placeholders, invented APIs, URLs, data, or backend behavior.
* Do not restructure unrelated code.
* Every file has **one clear responsibility**.
* Do not churn code that already meets the standard.

### Three-Pass Rule

For meaningful work:

1. Implement.
2. Self-review and fix weaknesses.
3. Review again as a strict senior engineer.

Do not narrate the passes.

---

## 3. Architecture

```text
route
 → page/screen
 → component
 → hook
 → service
 → connector
 → API / SQLite
```

**Pages compose. Components display. Hooks orchestrate UI state. Services own application operations. Connectors access external systems.**

### Structure

```text
src/
  components/<domain>/<Name>/index.tsx
  pages/<route>/index.tsx
  pages/<route>/<Name>Screen.tsx
  services/<name>Service.ts
  connectors/<name>Connector.ts
  shared/types/
  shared/utils/
  shared/hooks/
  shared/styles/
  shared/config/
```

The current single-page app uses `pages/home`; `app`, `auth`, `capture`, and `task` components; the `useTaskSet`, `useSync`, `useDictation`, and `useWorkspaceView` hooks; `localDataService`, `syncService`, `speechService`, and `workspaceService`; and the `sync`, `ai`, and `speech` connectors. The Cloudflare Worker lives in `worker/` and shares record types and validation with the app through `src/shared`. Add `router/` only when real URL routes are introduced; do not build routing for the four in-page views. `src/styles.css` is the existing global stylesheet.

Rules:

* No `features/` directory.
* No second home for components, services, hooks, or types.
* No barrel re-exports.
* Fix misplaced code instead of creating dependency exceptions.
* Dependencies point downward:

```text
pages → pages (same route), components, shared/hooks, shared
components → components, shared/hooks (types only), shared
shared/hooks → services, shared
services → services, connectors, shared
connectors → shared
shared/types|utils|styles|config → shared
```

Import a hook from a component only for its TypeScript return type; components receive data and callbacks as props. Run `npm run guardrails` after file moves and before submitting code. Update the gate when the approved structure changes.

### Data Flow

```text
page
 → component/screen
 → hook/orchestration
 → service
 → connector
 → API / SQLite
```

* Pages contain composition, not business logic or data access.
* Components render typed props and emit callbacks.
* Hooks own UI state and async orchestration.
* Services own application-level data operations.
* Connectors own API/SQLite/external access.
* DTOs never reach JSX.
* Adapt external DTOs into domain/display models before UI use.
* No mock-data architecture or duplicate data-access paths.

---

## 4. Components

Components must:

* Have one primary responsibility.
* Accept typed props.
* Render UI.
* Emit callbacks.
* Own only appropriate local presentation state.

Components must not:

* Fetch or persist data.
* Contain business workflows.
* Know raw backend DTOs.
* Duplicate service logic.
* Create speculative abstractions.

Prefer cohesive components such as:

```text
ModelCard
ModelFilters
ModelGrid
```

Split only at meaningful responsibility, reuse, or test seams. Do not create trivial wrappers to satisfy line counts.

Guidelines:

```text
component <150 lines
service   <200 lines
page      thin
```

These are signals, not hard limits.

---

## 5. Data & Type Boundaries

```text
external DTO
 ↓
adapter
 ↓
domain/display model
 ↓
component
```

Place:

```text
DTO/request/response types → shared/types
adapters/pure transforms   → shared/utils/<domain>/
state orchestration        → shared/hooks/
application operations     → services/
external access            → connectors
```

* Explicit types at every boundary.
* No `any`; if genuinely unavoidable, isolate and document it at the external boundary.
* Keep DTOs, domain models, and display models separate.
* Prefer discriminated unions and `Result<T>`.
* Keep nullability explicit.
* Navigation parameters and service contracts are typed.
* Never expose mutable internal state.

---

## 6. State & Async

Keep state minimal.

* Derive values instead of duplicating them.
* Maintain one source of truth.
* Do not mirror props into state unnecessarily.
* Do not lift state higher than required.
* Use immutable updates.

Async workflows must explicitly handle:

```text
idle → loading → success | error
```

Also deliberately handle where applicable:

* stale responses
* cancellation
* duplicate requests
* races
* unmounts
* retries
* error propagation

Never swallow errors.

---

## 7. Styling & Responsive UI

* Use the global design system and semantic tokens.
* Reuse existing styles before creating new ones.
* No raw colors, spacing, radii, or local design systems inside components.
* Avoid arbitrary magic values.
* Prefer flex, grid, and intrinsic sizing.
* Never solve layout problems with random offsets or positioning hacks.

Every important UI must work intentionally on:

```text
mobile · tablet · desktop
```

Requirements:

* No accidental horizontal scrolling.
* Preserve hierarchy instead of simply shrinking.
* Responsive layout and typography.
* Touch targets ≥44px.
* Images preserve aspect ratio and never stretch.
* Test genuinely narrow and wide layouts.

---

## 8. Interaction, Accessibility & Motion

Consider applicable states:

```text
default
hover
focus
pressed
disabled
loading
selected
error
success
```

* Focus must remain visible.
* Important state must not rely on color alone.
* Navigation uses the central router.
* Use semantic structure and accessible labels.
* Support keyboard interaction.
* Maintain adequate contrast.
* Support zoom/large text.
* Touch targets ≥44px.
* Respect reduced motion.

### Motion

Motion must communicate state, feedback, or spatial change.

Prefer:

```text
transform
opacity
short, purposeful transitions
```

Do not animate merely because animation is possible.

Glass, blur, filters, and other expensive effects are selective materials—not defaults.

---

## 9. Performance

Optimize **real or obvious bottlenecks**, not code for appearance.

Check:

* unnecessary renders
* O(n²) lookups
* large component/DOM trees
* large lists
* N+1 requests
* expensive render calculations
* image size/loading
* unnecessary observers/listeners
* blur/filter layers
* off-screen work
* bundle size

Use when justified:

```text
Map / Set
memoization
caching
virtualization
pagination
lazy loading
deferred rendering
```

Do not blindly add `useMemo`, `useCallback`, caching, or abstractions to trivial work.

---

## 10. Security

* Never hardcode secrets, credentials, tokens, or production URLs.
* Use `.env` for secrets.
* Never commit `.env` or local databases such as `db/hq.db`.
* Validate external input at boundaries.
* Use parameterized SQL only.
* Never invent API contracts or production endpoints.
* Never use `npm audit fix --force` without approval.
* Document unresolved vulnerabilities.

---

## 11. Testing & Verification

Logic changes require appropriate tests where supported, especially:

```text
adapters
parsing
connector behavior
sync/idempotency
cursor/pagination
edge cases
error cases
```

Required project gate:

```bash
npm run validate
```

This runs `guardrails`, browser and Worker typechecks, Vitest, and the Vite production build. The project has no separate lint script; do not claim one passed. Run the relevant Worker bundle check when Worker code or config changes.

Never claim success when a gate fails. Report the exact command and result.

### UI Verification

```text
build
→ render
→ inspect mobile + desktop
→ test interaction states
→ check console/runtime
→ compare reference
→ fix largest mismatch
→ repeat
```

Priority:

```text
layout
→ hierarchy
→ spacing
→ typography
→ proportions
→ color
→ interaction
→ motion
→ details
```

Manual verification is mandatory. Guardrails are part of the build contract.

---

## 12. Code Review

Prioritize:

```text
correctness
→ architecture
→ data boundaries
→ state/error handling
→ performance
→ responsive behavior
→ accessibility
→ maintainability
→ polish
```

Severity:

```text
P0  incorrect behavior, security, races, data/business logic in UI
P1  architecture violations, unsafe types, stale async, major performance issues
P2  duplication, magic values, unnecessary fragmentation, dead code
P3  naming, documentation, minor polish
```

Every finding must identify:

```text
path/line
→ problem
→ why it matters
→ specific fix
```

Do not report vague quality concerns.

---

## 13. Refactoring

Refactors preserve behavior unless a bug fix is explicitly requested.

For structural moves:

```text
map old path → new path
→ resolve imports
→ dry-run
→ move with git mv
→ remove/expand barrels
→ update references/docs/guardrails
→ run gates
```

Do not combine unrelated behavioral refactors with structural moves.

Keep architecture guardrails automated so structural regressions fail early.

---

## 14. Finish Standard

Before reporting completion:

```text
inspected
→ changed
→ self-reviewed
→ verified
→ files identified
→ gates passed
→ limitations stated
→ no unrelated features added
```

Final check:

```text
correct layer?
smallest correct change?
real data path?
typed boundaries?
single source of truth?
race-safe?
responsive?
accessible?
performant?
no duplicate system?
no speculative features?
gates passed?
```

For meaningful work, briefly update `▶ Resume here` in `docs/build-plan.md`.

### Completion Report

Keep it brief:

```text
changed
why
files
verification
limitations
```

**Never say "done" unless the required verification gates pass.**
