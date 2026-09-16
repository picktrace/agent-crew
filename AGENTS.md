# AI Coding Assistant Instructions

These rules are shared with `web-client`. Where a rule exists there, it is
carried here in the same words, so a person moving between the two repos reads
the same thing.

## Commands

- **TypeScript check**: `pnpm tsc`
- **Tests**: `pnpm test`
- **Run the app**: `pnpm dev`
- **Build**: `pnpm build`

pnpm only. Never npm or npx.

## How to Use Patterns

1. **Check [`.agents/context.md`](./.agents/context.md)** for available patterns and references
2. **Navigate to specific pattern** in [`.agents/patterns/`](./.agents/patterns/) for detailed templates
3. **Copy template** and replace bracketed variables with actual values
4. **Follow naming conventions** and project structure guidelines

## Before you write anything

Read [`docs/decisions.md`](./docs/decisions.md). Eighteen decisions, each with
the fact that decided it. If your change contradicts one, say which one, and
say what new fact changes it.

Read [`docs/architecture.md`](./docs/architecture.md) section **What breaks at
scale** before touching terminals, state files or subscriptions. Every rule
there came from a bug a shipped tool in this space hit after it was working.

## Project structure

Four layers. Each one runs without the layer above it.

```
src/ui/         React and xterm.js. Draws. Owns no process.
src/app.ts      the only file that imports Electron
src/engine/     every decision. Knows nothing about windows.
src/crewd/      the service. Owns pseudo terminals. Epic 8.
```

**The engine must run with no window open.** If `crew start` works from a
terminal, the layers are correct. If it stops working, window code has leaked
into the engine. That is a bug, not a style preference.

Only `src/app.ts` may import `electron`. Nothing else, ever.

### Component Organization

- Group related components in feature folders
- Use descriptive naming: [Domain][Feature][ComponentType]
- Create utils/ subfolder for helpers and validation schemas
- Export data providers and hooks from main component files

## TypeScript Rules

- **No `any`** — use proper types, `unknown` with narrowing, or `ReturnType<typeof fn>` / `Awaited<ReturnType<typeof fn>>` to infer from existing functions. `any` in a third-party interface type is acceptable to satisfy, but never introduce it yourself.
- **No type assertions (`as`)** and **no non-null assertions (`!`)** — narrow with guards, early returns, or `continue`.

## Best Practices

- Always check existing patterns before creating new ones
- Prefer editing existing files over creating new ones
- Use `clsx` for conditional classNames instead of template literals (e.g., `clsx(classes.root, isSelected && classes.selected)` instead of `` `${classes.root} ${isSelected ? classes.selected : ''}` ``)
- DO NOT create `index.ts` files inside packages - they cause tree-shaking issues and circular dependencies. Use direct imports instead (e.g., `import { Foo } from './Foo'` instead of `import { Foo } from './'`)
- DO NOT use TypeScript non-null assertions (`!`) or type assertions (`as`). Narrow types properly with guards, early returns, or `continue` — even if the assert is "obviously safe".
- Prefer reading data from context over props when a component is not shareable (used in one feature/domain only). Only use props for layout customization (e.g., `className`) or when the component is genuinely reused across different data sources.
- Use full English words for identifiers. Abbreviations are only acceptable when universally understood in context (e.g., `props`, `params`, `ref`, `id`, `url`, `err`). Avoid single-letter names, domain-specific shorthands, or truncated words (e.g., `accumSigs`, `ltRecord`, `sig`).
- Name module-level constants with camelCase (like regular variables) when they are not exported and are used only within the same file. SCREAMING_SNAKE_CASE is reserved for exported constants or constants shared across files (e.g., `const shortNameByFileName = ...` not `const SHORT_NAME_BY_FILE_NAME = ...`).
- Prefer `{ [key in string]?: string }` over `Record<string, string>` for index signatures — `Record<string, V>` makes all keys required and the return type non-nullable, hiding the possibility of missing keys. Use `Record<K, V>` only when `K` is a finite union and all keys are guaranteed to be present.
- Comment sparingly, and only on what the code cannot say itself. A comment earns its place when it carries something the next reader must know but the code can't show them: a constraint they'd otherwise violate, a value arrived at by measurement, a bug the line prevents. Delete anything that restates the line below it, and keep what survives to a minimum (a line or two when possible). A prop named `expandedByDefault` needs no comment saying it expands the group by default; it may need one saying that search drives it because matches hidden behind a collapsed header read as a broken search. The rationale for a decision — why this alternative over that one, why this entry point or dependency — is not a code comment. Once merged, a justification of a settled choice is noise for every future reader; its durable home is the commit message. Test each comment: a forward-looking constraint the maintainer must respect stays in the code; a backward-looking defense of a choice already made goes in the commit.
- Build a branch as a sequence of incremental, atomic commits, each a single logical change. This isn't cosmetic: small isolated diffs are far easier for a reviewer to reason about, let git bisect pin a regression to one commit, and let one part be reverted easily without disturbing the rest. Each commit should have a self-contained message, leading with impact or intent, mechanism second — carrying the context a reviewer can't recover from the diff alone (e.g. why now, what it unblocks, what you ruled out). Separate the mechanical from the behavioral: a pure rename, an extract-for-reuse refactor, and the feature that needed them are distinct commits, sequenced refactors-first so the behavior change lands as a small, legible diff.

## Rules specific to this project

Each one comes from a measured bug, not a preference. The evidence is in
[`docs/evidence.md`](./docs/evidence.md).

### Never store what can be derived

Cost, agent state, dirty files, whether a pull request is open. All read fresh.
A stored copy can be wrong. A derived answer cannot.

### A pane id is a uuid we mint, never a process id

Process ids change on restart. A saved layout that names a process id points at
nothing the next time the app opens.

### Never read meaning out of terminal bytes

A real 561 byte capture of one `echo` was almost entirely cursor moves and
colour codes. Agent state comes from hooks. When the signal is missing, say
unknown. Never guess.

### Keep `workspace.json` small

Never put in it: scrollback, any cache, anything written every few seconds,
pretty printed JSON. Never rewrite the whole file on a view change.

### Bound the terminal output buffer

Never join strings as pty chunks arrive. Keep a bounded queue of chunks and drop
the oldest. A busy agent writes 64 KB at a time.

### Whatever starts a timer owns clearing it

Never a lifecycle effect that runs again on every render. This was the single
most repeated fix in the codebase we studied: 65 separate commits.

### Count your subscriptions

One tool in this space had 48 store listeners per pane before cutting it to 17.
Nobody writes 48 on purpose. They arrive one at a time, each one reasonable.

### Nothing outward happens without a click

No message, no pull request, no merge happens on its own in v1. Three things are
wired into the code with no setting at all: never merge to `production`, never
change our own settings, never touch files outside the workspace.

### Never write inside someone's repo

Hook settings are passed to an agent with a flag. They are not dropped into a
working folder.

## Write a lint rule for every bug you fix twice

A fix stops one bug. A lint rule stops every future one. Custom rules live in
`config/lint-plugins/`, each named after the bug it prevents.

## Testing

Three levels. The middle one carries most of the value.

- **Unit.** Pure functions, no disk, no network. The layout tree after a split. Turning a title into a branch name. Parsing a transcript line.
- **Against real files.** Point a reader at saved transcripts and check the number to the cent. This found three real bugs in the prototype, including one that made every bill 2.50 times too high.
- **End to end.** A handful only. They are slow.

Most tests need no Electron, because the engine does not import it.
