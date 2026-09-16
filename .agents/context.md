# AI Coding Assistant Context

## Project Patterns

Nothing here yet. This file fills up as patterns appear in the code.

A pattern earns a place here when it is used in three places. Two is a
coincidence.

### Patterns we expect to need

| Pattern | When it will appear |
|---|---|
| Runtime interface, so a pty backend can be swapped | Epic 1 |
| Adapter, so a second coding agent can be added | Epic 1 |
| Tracker, forge and chat interfaces, each with an off state | Epics 2, 3 |
| Data provider, React context for shared state | Epic 5 |

The tracker, forge and chat shapes are already written in
[`docs/architecture.md`](../docs/architecture.md). They move here once code
exists.

## TypeScript Rules

- **No `any`** — use proper types, `unknown` with narrowing, or `ReturnType<typeof fn>` / `Awaited<ReturnType<typeof fn>>` to infer from existing functions. `any` in a third-party interface type is acceptable to satisfy, but never introduce it yourself.
- **No type assertions (`as`)** and **no non-null assertions (`!`)** — narrow with guards, early returns, or `continue`.

## Layer Rules

- Only `src/app.ts` imports `electron`
- The engine runs with no window open
- Never store what can be derived
