# agent-crew lint rules

One rule per bug we have fixed twice. A fix stops one bug. A rule stops every
future one.

Add a rule here, register it in `index.cjs`, and name the file after the bug it
prevents.

## Rules we already know we will need

These come from `docs/architecture.md`, section **What breaks at scale**. Each
one is a real bug a shipped tool in this space hit after it was working. Write
the rule when the first one lands in our code, not before.

| Rule | Prevents |
|---|---|
| `no-quadratic-buffer-concat` | joining strings as pty chunks arrive |
| `no-timer-in-effect` | a timer started inside a lifecycle effect |
| `no-electron-outside-app` | any file but `src/app.ts` importing electron |
| `no-derived-state-in-store` | writing cost or agent state into `workspace.json` |
