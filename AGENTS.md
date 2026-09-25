# Task Set repository instructions

Before changing code, read [docs/engineering-rules.md](docs/engineering-rules.md) and the relevant product, design, and build-plan docs. Follow the existing structure and search for reusable code before adding a new module.

For every code change:

1. Keep pages thin, UI components prop-driven, orchestration in hooks, persistence in services, and network access in connectors.
2. Put new files in the established source home. Do not add a `features/` tree, second component or service home, or barrel exports.
3. Preserve behavior unless fixing a concrete bug. Add focused tests for changed logic.
4. Run `npm run validate` before reporting completion. It runs structure and import guardrails, TypeScript, tests, and the production build. For Worker or Wrangler changes, also run `npm run worker:dry-run`. Report any failed gate honestly.
5. Review the changed files and update `docs/build-plan.md` for meaningful work.

The full code review rubric and the current project-specific layout are in the engineering rules. Apply them during implementation so a separate cleanup pass is unnecessary.
