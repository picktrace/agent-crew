# agent-crew: architecture

Last updated: 2026-09-16
Status: design agreed. No code yet.

This is how the pieces fit together, and why each boundary is where it is.

---

## The shape, in one picture

```
  ┌──────────────────────────────────────────────────┐
  │  window                                          │
  │  React, xterm.js. Draws. Owns no process.        │
  └───────────────────┬──────────────────────────────┘
                      │ messages
  ┌───────────────────▼──────────────────────────────┐
  │  main                                            │
  │  three files. The only layer with Electron.      │
  └───────────────────┬──────────────────────────────┘
                      │ function calls
  ┌───────────────────▼──────────────────────────────┐
  │  engine                                          │
  │  every decision. Knows nothing about windows.    │
  │                                                  │
  │  workspace   worktree   agent   usage            │
  │  journal     store      prompt  asks             │
  │  tracker     forge      chat                     │
  └───────────────────┬──────────────────────────────┘
                      │ a socket
  ┌───────────────────▼──────────────────────────────┐
  │  crewd, the service                              │
  │  owns every pseudo terminal. Outlives the window.│
  └──────────────────────────────────────────────────┘
```

Four layers. Each one can be used without the layer above it.

## The rule that keeps it honest

**The engine must run with no window open.**

If `crew start LMG-1729` works from a terminal, the layers are correct. If it
stops working, window code has leaked into the engine, and that is a bug to fix
rather than a style preference.

The command line tool is not a side feature. It is the test that the boundary
holds.

## Why the service is separate

An agent takes 40 minutes on a real ticket. You will close the window in that
time.

If the window owns the process, closing it kills the agent. So something else has
to hold it.

`crewd` is a plain process. It listens on a socket, it owns the pseudo terminals,
and it knows nothing about tickets or costs. Its whole job is: keep these
processes alive, pass bytes both ways, and remember what each one printed.

```
crewd owns                     crewd does not know
──────────────────────────     ────────────────────────
pseudo terminals               what a ticket is
process lifetime               what an agent is
scrollback per pane            what anything costs
resize                         which repo is which
```

That split matters. A service that understands tickets is a service you have to
restart whenever ticket handling changes.

## Layers, one at a time

### The window

React and xterm.js. It draws what it is told and sends back what you type.

It holds no state that matters. Close it and lose nothing. Every number on
screen came from the engine, and every number in the engine came from a file.

xterm.js is the one library we cannot replace. Turning a byte stream into a grid
of characters means handling the cursor, colours, scrolling regions, wide
characters, and hundreds of escape codes.

### main

One file. The only place that imports Electron.

It turns messages from the window into engine calls, and engine results into
messages back. Nothing else.

This is what makes the engine testable without launching an app.

### The engine

Where every decision lives. Broken into parts by what they know about.

| Part | What it knows |
|---|---|
| `workspace` | the start flow, and what a workspace is |
| `worktree` | git. Make, list, remove, clear stale records |
| `agent` | launch an agent, track its session, resume it |
| `usage` | read transcripts, add up tokens, apply prices |
| `journal` | append one line, read them all back |
| `store` | read and write `workspace.json` |
| `prompt` | build the first thing an agent reads |
| `asks` | a question the agent wrote, and what you do with it |
| `tracker` | Jira, or nothing |
| `forge` | GitHub, or nothing |
| `chat` | a messaging tool, or nothing |

Each part is a folder with an interface at the front. Nothing reaches into
another part's internals.

### crewd

The service. Covered above.

## The three interfaces that must be swappable

Jira is not the only tracker. GitHub is not the only git host. Not everyone uses
the same chat tool.

So each of those sits behind one interface, and the rest of the engine never
learns which one is in use.

```ts
interface Tracker {
  name: string
  available(): Promise<boolean>
  get(key: string): Promise<Ticket>
  create(input: NewTicket): Promise<Ticket>
}

interface Forge {
  name: string
  available(): Promise<boolean>
  openPr(input: NewPr): Promise<PullRequest>
  prFor(branch: string): Promise<PullRequest | null>
  comments(pr: PullRequest): Promise<Comment[]>
  reply(c: Comment, text: string): Promise<void>
  merge(pr: PullRequest): Promise<void>
}

interface Chat {
  name: string
  available(): Promise<boolean>
  send(to: string, text: string): Promise<void>
}
```

Three states for each, and the app behaves sensibly in all three:

```
available() false, no keys   ->  the feature is hidden
a command line tool found    ->  use it
keys entered                 ->  use the API directly
```

Keys win over a command line tool. If someone entered them, that is the account
they meant.

The same interface serves both. `JiraViaCli` and `JiraViaApi` both satisfy
`Tracker`. Nothing above them changes.

## The agent adapter

The same idea, one layer down. Claude Code is not the only coding agent.

```ts
interface AgentTool {
  id: string                                  // "claude-code"
  command(run: Run): string[]                 // what to start
  transcriptDir(cwd: string): string          // where it writes its records
  parseUsage(line: string): Usage | null      // how to read a token count
  installHooks(run: Run): Promise<string>     // how it reports its state
}
```

Adding another coding agent is one file. Nothing else moves.

## How data flows

### Starting work

```
you type "LMG-1729"
  -> tracker.get("LMG-1729")            read the ticket
  -> derive branch, name, base          rules, not an LLM
  -> you confirm or edit
  -> worktree.add(repo, branch, base)   one per repo
  -> journal.append(worktree_added)     x2
  -> prompt.write(ticket, skills, people)
  -> crewd.spawn(cwd, command)          the agent starts
  -> journal.append(pane_opened)
  -> store.save(workspace.json)
```

Every step is journaled as it happens. A crash anywhere leaves a readable trail.

### While it works

Two things run on a timer, and they read different sources.

```
every 2s:  usage.read(cwd)         -> cost, per agent and subagent
           asks.pending(workspace) -> is it waiting on you

on event:  hooks fire              -> working, idle, blocked, done
           crewd sends bytes       -> the terminal redraws
```

Nothing on that list is stored. All of it is read fresh.

### Coming back after a crash

```
read journal.jsonl from the top
  -> which worktrees exist          check they are still on disk
  -> which panes there were         and what each was for
  -> the layout                     restore the tree
  -> the agent session id           claude --resume <id>
```

The journal is the recovery path. Not the service, and not a database.

## Where things are written

```
~/.crew/
  settings.json          yours. Editable by hand.
  credentials.json       mode 600. Keys only.
  crewd.sock             the service socket

~/workspaces/<workspace>/.crew/
  workspace.json         the durable state
  journal.jsonl          append only, never edited
  scrollback/<pane>.bin  what each pane printed
  prompts/lead.md        what the agent was told to read
  asks/<id>.json         a question waiting for you
```

Nothing under `~/workspaces/<workspace>/<repo>/`. **We never write inside your
repo.** Hook settings are passed to the agent with a flag instead of being
dropped into your working folder.

## What we never do

**Store anything we can derive.** Cost, agent state, dirty files, pull request
state. All read fresh. A stored copy can be wrong. A derived answer cannot.

**Name a pane by its process id.** Process ids change on restart. The saved
layout would then point at nothing. Every pane gets a uuid we mint.

**Read meaning out of terminal bytes.** A real 561 byte capture was almost all
instructions for the screen: turn on bold, move the cursor, clear the line. State
comes from hooks.

**Send anything outward without a click.** No message, no pull request, no merge
happens on its own.

**Write inside someone's repo.** Ever.

## What breaks at scale, and how to not repeat it

These are not opinions. Each one is a problem a shipped tool in this space hit
after it was already working, and had to go back and fix.

### Keep the durable state file small

We chose one JSON file per workspace. That is right, and it breaks if you put
the wrong things in it.

Four kinds of data had to be pulled back out of a state file that had already
shipped:

| Do not put this in `workspace.json` | Where it goes |
|---|---|
| scrollback | its own file, per pane |
| any cache | a separate file, written at quit |
| anything written every few seconds | an append only log, not a rewrite |
| pretty printed JSON | compact. Pretty printing is for reading, not saving |

Two more rules fall out of the same lesson:

- **Never rewrite the whole file on a view change.** Only on a real change to
  durable state.
- **Never checkpoint a full buffer on a timer.** Append what is new.

The first version of that tool wrote its whole terminal buffer every 5 seconds.
It had to be replaced with an incremental log.

### Bound the terminal output buffer

Joining strings as pty chunks arrive is quadratic work. A busy agent writes
64 KB at a time.

Keep recent output in a bounded queue of chunks, and drop the oldest. Never
build one growing string.

### Get agent state from markers, not from words

An agent's state must come from an explicit signal, such as a hook firing. Never
from reading what the agent wrote.

Reading prose looks like it works, and then it does not. The tool we studied
shipped a prose-based guess, then replaced it with explicit turn markers, then
moved the parsing out of the window and into the runtime.

Three related rules:

1. Parse status in the engine, not in the window. The window can be closed.
2. One agent identity, used by every part. Not one for tabs and another for
   status.
3. When the signal is missing, say unknown. Never guess.

### Watch fewer files

Watching a whole worktree for changes is expensive on macOS. Watch the few paths
you actually read, and turn the watcher off when the workspace is not on screen.

### A service can be alive and stuck

Epic 8 says the service restarts itself if it dies. That is not enough.

A service can be running, holding a socket, and answering nothing. Plan for
replacing a wedged service, not only a dead one. A health check with a deadline,
and a replacement when it misses.

### Do not put timers inside view effects

This is a window problem, and it is the single most repeated fix in the codebase
we studied. 65 separate commits, all moving a timer or a cleanup out of an effect
and into the handler that started it.

The rule: whatever starts a timer owns clearing it. Not a lifecycle effect that
runs again on every render.

### Four terminal problems that are not obvious

From 11,089 commits of a shipped tool. None of these would come up in a design
discussion. All four cost that team real time.

**1. Restoring a terminal restores its modes, and they can be wrong.**

A terminal carries state beyond its text. Mouse tracking on or off. Alternate
screen or not. Bracketed paste on or off.

If an agent had mouse tracking on when the window closed, the restored pane is
stuck in mouse mode with nothing listening to it. Clicks go nowhere.

On restore, reset every mode to a known state. Do not trust what was saved.

**2. Wide characters take two cells.**

Korean, Chinese, Japanese and most emoji are two columns wide, not one. Get it
wrong and every line after them is misaligned.

Pin this in a test, with a real string, for every way you render.

**3. Paste is three different things.**

Middle click on Linux is not Cmd+V on macOS is not Ctrl+V in a browser. A naive
handler makes one of them paste twice.

**4. An escape sequence can be split across two chunks.**

The pty hands you bytes when it has them, not when a sequence is finished. Half
an escape code can arrive in one chunk and the rest in the next.

Carry the partial across chunk boundaries. A parser that assumes each chunk is
whole will drop colours and links at random.

### Write a lint rule for every bug you fix twice

The tool we studied keeps five custom lint plugins, each named after a bug they
were tired of. One of them is the pty buffering bug from the section above:

```
quadratic-buffer-concat

  "Buffer.concat rebuilds loop-carried X;
   collect chunks and concatenate once after the loop."
```

They hit it, fixed it, then made it impossible to write again.

This is the cheapest practice in their whole repo, and it is worth copying from
the first week. A fix stops one bug. A lint rule stops every future one.

### Count your subscriptions

One of their later fixes reads:

```
perf(terminal): cut per-pane store listeners from 48 to 17
```

48 listeners per pane. With 10 panes open, that is 480 subscriptions on a tool
you leave running all day.

Nobody writes 48 listeners on purpose. They arrive one at a time, each one
reasonable. Count them early, and put a ceiling on them.

### What a mature version of this spends its time on

Their last 4,089 commits, against the 5,000 before them, per 1,000 commits:

| Topic | middle | mature | |
|---|---|---|---|
| performance | 82 | 179 | more than doubled |
| tests | 24 | 86 | tripled |
| sessions and restore | 36 | 68 | nearly doubled |
| terminal and pty | 126 | 149 | still growing |
| pull requests | 97 | 32 | finished |

Pull request work stops. Terminal work never does.

That is worth knowing before we start. Epic 1 is not a week. It is the part of
this product that keeps needing attention for as long as it exists.

## Testing

Three levels, and the middle one is where most of the value is.

**Unit.** Pure functions, no disk, no network. Parsing a transcript line. Turning
a title into a branch name. Deciding the base branch. Working out the layout
after a split.

**Against real files.** Point the reader at a folder of saved transcripts and
check the cost to the cent. The prototype found 3 real bugs this way, including
one that made every bill 2.50 times too high.

**End to end.** Make a workspace in a temp folder, start a real agent, check it
answered, close it. Slow, so only a handful of these.

The engine's no-window rule pays off here. Most tests need no Electron at all.

## Build order

The epics are already in dependency order. The architecture falls out the same
way.

| Epic | What gets built |
|---|---|
| 1 | `settings`, `doctor`, the three interfaces with their off states |
| 2 | `worktree`, `journal`, `store`, `prompt`, `tracker` |
| 3 | `crewd`, the pty layer, the layout tree, the window's terminal |
| 4 | `usage` |
| 5 | hooks, subagent reading |
| 6 | `asks`, `chat` |
| 7 | `forge` |
| 8 | the workspace list, notifications |
| 9 | `orchestration`, workers |
| 10 | packaging, Windows |

Epic 3 is the largest and the riskiest. Everything before it works without the
service, so build the service as an upgrade rather than a foundation.

## Open questions

| Question | Blocked on |
|---|---|
| How the window and `crewd` talk | pick a socket format in Epic 3 |
| Where daily and weekly totals live | Epic 4 |
| Whether `crewd` restarts itself | Epic 3 |
| How a profile is shared between people | Epic 10 |
