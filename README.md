# agent-crew

Run many coding agents from one window. One ticket in. Worktrees, agents, and a
live cost readout out.

The command is `crew`.

**Status: design only. No code has been written.**

---

## Where to start, depending on why you are here

| You want to | Read |
|---|---|
| know what we are building, and why | `docs/plan.md`, Part 1 |
| review a decision and check the reasoning | `docs/decisions.md` |
| check a number we quoted | `docs/evidence.md` |
| know how the code will be laid out | `docs/architecture.md` |
| know what gets built, and in what order | `docs/plan.md`, Part 2 |
| know what we have not decided | `docs/decisions.md`, at the end |
| write code here | `AGENTS.md` |

There is also a single page version of the whole plan, with the same content:
<https://claude.ai/artifact/Cro9j98vckxtLqRu8Ykamk>

---

## What it does

1. You give it a ticket, for example `LMG-1729`. Or you just describe the problem.
2. It makes one git worktree per repo the work touches. A worktree is a second
   checkout of a repo, on its own branch, in its own folder.
3. It starts one agent for the ticket, and shows its terminal.
4. It shows what the work has cost, per agent and per subagent.
5. When the agent gets stuck, it writes a question and stops. You read it, then
   press send.
6. When the work is done, you open the pull request from the same window.

## What it does not do

It is not a robot that works alone. A person approves every outward action. You
press send on the message. You press the button that opens the pull request.

That is a v1 choice, not a permanent one. `docs/plan.md` has the four levels of
autonomy, and what each one costs.

---

## How to review this

Every decision has the same shape, in `docs/decisions.md`:

- what we chose
- what we rejected
- **the fact that decided it**
- what would change our mind
- what it costs

The third line is the one to check. A decision is only as good as the fact behind
it. Every fact has a command in `docs/evidence.md` that reproduces it.

If a number in `docs/evidence.md` is wrong, say which one. The decision it
supports is then wrong too, and `docs/decisions.md` names that decision.

`docs/evidence.md` also has a section called **What we have not measured**. Six
claims in this design rest on judgment rather than a number. They are listed
there rather than hidden.

---

## The state of it

```
docs/plan.md           the strategy, and 10 epics with stories
docs/architecture.md   four layers, the interfaces, what breaks at scale
docs/decisions.md      18 decisions, each with the fact behind it
docs/evidence.md       every number, with the command that produced it
docs/state-model.md    the three tiers of state
AGENTS.md              how to write code here. Shared with web-client.
```

Nothing is built. One commit, all design.

## The first thing to build

Epic 1: a terminal in a window, with an agent in it.

Not settings. Not worktrees. The terminal, because it is the riskiest part and
the most visible one. `docs/decisions.md` D-16 has the evidence for that order.
