# agent-crew: strategy and epics

Last updated: 2026-09-16
Status: design agreed. No code yet.

Run many coding agents from one window. One ticket in. Worktrees, agents, and a
live cost readout out.

The command is `crew`.

---

# Part 1: the strategy

## What we are building

A desktop app. You give it a ticket. It makes the worktrees, starts one agent,
shows you what the agent is doing, and tells you what it cost.

A worktree is a second checkout of a repo, on its own branch, in its own folder.

When the agent gets stuck it writes a question and stops. You read it, then send
it. When the work is done you open the pull request from the same window.

## What we are not building

Not a robot that works alone. A person approves every outward action. You press
send on the message. You press the button that opens the pull request.

## The decisions, and the reason that decided each one

| Topic | Choice | The reason |
|---|---|---|
| Name | `agent-crew`, command `crew` | a crew is people working together on one job |
| Language | TypeScript, Electron | the people at PickTrace who will help are frontend people |
| Terminals | we own them | the alternative cannot run on Windows |
| pty library | `node-pty` | 2,027 stars, Microsoft, ships in VS Code |
| First platforms | macOS, Linux | Windows later, but the design allows it |
| Durable state | one JSON file per workspace | readable in an editor, no database to migrate |
| Journal | append only, written by us | this is how we recover |
| Restart | a background service holds the terminals | agents keep working while the window is closed |
| Repo | one repo, flat, at `~/code/agent-crew` | on his machine first |

### The language choice was not technical

Go would ship 15 MB instead of 306 MB. Rust would ship 3 MB and start in 380 ms.

Neither matters as much as who will contribute. The people at PickTrace who
would jump in are frontend people. A tool nobody helps with is a tool that dies.

A Go version will exist as a separate personal project.

### Why we own the terminals

The alternative is to run everything inside `tmux`, a program that keeps
terminals alive in the background. It gives a lot away for free:

- it is already a background service, so agents live when the window closes
- it stores the split layout as one string, and one command restores it
- it can return the full scrollback of a pane. Tested at 503 lines
- you can attach to it from any terminal, with no extra code

None of that decided it. **tmux does not run on Windows.** Only inside WSL, which
is a Linux machine running inside Windows. `/usr/bin/tmux` does not exist on a
fresh Mac either, so every user would have to install it first.

Owning the terminals costs us a background service, a layout tree, and
scrollback keeping. It buys us every platform.

### Why a journal, and not just a service

A background service does not save you. There are three ways things die, and a
service only helps with the first.

| What dies | agents survive? |
|---|---|
| the crew window | yes, the service holds them |
| the service | no |
| the machine reboots | no |

What gets you back is knowing where you were. Claude Code already journals the
agent side. One real session held 1,745 timestamped entries. It knows nothing
about what crew did, so crew writes its own.

## The state model

Three tiers, split by what survives a restart.

### Tier 1: durable

```ts
type Workspace = {
  id: string          // "lmg-1729-review-records". Folder name. Safe characters only.
  branch: string      // "hotfix/lmg-1729-cannot-review-production-records"
  ticket?: string     // "LMG-1729". Optional. 40 percent of real work has none.
  title: string       // "Cannot Review Production Records". What you read.
  kind: 'feature' | 'hotfix' | 'chore'
  createdAt: string
  repos: Repo[]
  layout: LayoutNode
  panes: PaneRecord[]
}

type LayoutNode =
  | { kind: 'leaf';  paneId: string }
  | { kind: 'split'; dir: 'row' | 'col'; ratio: number;
      first: LayoutNode; second: LayoutNode }

type PaneRecord = {
  paneId: string            // ours. a uuid. never an operating system id.
  role: 'agent' | 'shell' | 'diff' | 'logs'
  cwd: string
  agentSessionId?: string
  title?: string
}
```

### Tier 2: live

Exists only while the service runs.

```ts
type LivePane = {
  paneId: string
  pid: number
  pty: IPty
  cols: number
  rows: number
  scrollback: Buffer
}
```

### Tier 3: derived

Read fresh every time. **Never written to `workspace.json`.**

| What | Read from |
|---|---|
| tokens and cost | the Claude JSONL transcript files |
| agent state: working, idle, blocked | Claude Code hooks |
| current tool and its input | the same hooks |
| subagents, and what each is doing | the subagent JSONL files |
| repo dirty, commits ahead | `git status`, `git rev-list` |
| is a pull request open | the git host API |

If it can be derived, derive it. A stored copy goes stale. A derived answer is
always right.

### Where it lives

```
~/workspaces/lmg-1729-review-records/.crew/
  workspace.json      tier 1
  journal.jsonl       append only, never edited
  scrollback/
    a7f2.bin
  prompts/
    lead.md
```

No database. Open any of it in an editor.

### The journal

One line per thing that happened. Written the moment it happens.

```json
{"id":"e04","at":"...","what":"worktree_added","repo":"web-api"}
{"id":"e05","at":"...","what":"pane_opened","paneId":"a7f2","role":"agent"}
{"id":"e09","at":"...","what":"agent_session","sessionId":"d49d46ca-..."}
{"id":"e12","at":"...","what":"pr_opened","repo":"web-client","causedBy":"e09"}
```

A whole ticket is about 13 lines. There is nothing to batch, so write every
entry immediately.

Journal only what changes durable state. Never journal derived things, or the
two copies can disagree.

The journal is a flat list, not a graph. `causedBy` is optional. Follow it
backwards when you need a chain. The dependency graph lives in the task model.

## One ticket, one agent

Two repos on a ticket is **one job that touches two folders**. It is not two
jobs.

The prototype started one agent per repo. LMG-1729 spent **$2.71**, with both
agents reading the same ticket separately, and neither knowing what the other
had decided.

The lead agent sits at the workspace root. Every repo is a folder below it. The
lead reads the ticket, then decides for itself whether to split the work.

**A subagent is not a terminal.** One real session spawned **44 subagents**
inside **1 process**, using **0 extra terminals**. They are rows in a list.

**A worker is a terminal.** That is the orchestration layer, and it comes later.

## Things we learned from the real repo

Checked against `web-api`, not assumed.

**40 percent of branches have no ticket.** Of the last 25 merged pull requests,
10 had no ticket id at all. So a workspace cannot require one.

**Branch names follow 5 patterns, not 1.**

| Pattern | Example | Count in 25 |
|---|---|---|
| `TICKET-NNNN-slug` | `LMD-1201-audit-reports-py-store` | 11 |
| plain slug | `changelog-group-by-date` | 8 |
| `task/slug` | `task/qc-forms-device-sync` | 3 |
| `fix/TICKET` | `fix/LMC-1507` | 1 |
| `hotfix/slug` | `hotfix/missing-len-checks-...` | 1 |

**A hotfix branches from `production`, not `main`.** `production` is cut from
`main` every Monday to Thursday at 4pm. There were 5 hotfix tags in 2 weeks, so
this path matters.

```ts
const base = kind === 'hotfix' ? 'origin/production' : 'origin/main'
```

**Git already knows the folder layout.** Listing worktrees from a clone names
every one of them. Asking a worktree for its shared git folder names the clone.
So crew discovers a person's layout instead of imposing one.

## Three bugs the prototype found. Do not repeat them.

1. **One reply is written on several lines.** 86 assistant lines, 44 requests.
   Adding up every line makes the bill **2.50 times too high**. Keep one line per
   request id.
2. **Lines marked `<synthetic>` are not real API calls.** Claude Code writes them
   itself. All 40 on this machine carry zero tokens.
3. **The transcript folder name is not reversible.** `/code/web-api/employees`
   and `/code/web-api-device-sync` produce names starting with the same text.
   Read the real path out of the file. Never match on the folder name.

## Settings: nothing is required

Every integration has three states.

```
not configured   ->  the feature is hidden. No error, no nagging.
found a CLI      ->  use the tool already on this machine
keys entered     ->  talk to the API directly
```

Keys win over a command line tool. If you entered them, that is the account you
meant.

```json
{
  "tracker": { "use": "auto" },
  "forge":   { "use": "auto" },
  "chat":    { "use": "off" },
  "branch":  { "feature": "{ticket}-{slug}", "hotfix": "hotfix/{slug}" },
  "repos":   { "roots": ["~/repos/picktrace"],
               "worktreePath": "~/workspaces/{workspace}/{repo}" }
}
```


## People, by the role they play

You do not type a Slack id. You type a name, and crew finds the rest.

Slack already knows who someone is. Searching for "Vlad" returns this:

```json
{ "id": "USG2VBM60",
  "profile": { "real_name": "Vladimir Mokshin",
               "title": "Engineering" } }
```

So crew stores the id and the role together, and you confirm the role rather
than type it.

```json
[
  { "name": "Vlad", "slack": "USG2VBM60", "github": "windheart",
    "role": "engineering" },
  { "name": "Sam",  "slack": "U4F1G2D0Q", "github": "sam-picktrace",
    "role": "product" }
]
```

### Why the role matters more than the name

An agent that knows 4 names does not know who to ask. An agent that knows 4
roles does.

| The agent is stuck on | It asks |
|---|---|
| should BOXES be checked by default | product |
| is this covered by an existing test | QA |
| does this match the handler in crew-schedules | engineering |
| what should the empty state say | design |

The start screen asks once, grouped by role:

```
  Who might you need on this?

  Product      [ Sam ]  [ + add ]
  QA           [ + add ]
  Engineering  [ Vlad ]  [ + add ]
  Design       [ + add ]
```

Typing in a box searches Slack by name or email, and shows real people with
their titles. Pick one and crew stores the id.

The prompt then names them by what they decide, not just who they are:

```
## If you get stuck on a decision

Some questions are not in the code. These people decide them:

- product      Sam
- engineering  Vlad

Do not message anyone. Write your question to the file below and stop.
Say which of them should answer it, and why.
```

## Robot mode

Everything above assumes a person presses every outward button. Robot mode is
the opposite: the agent runs the loop with nobody in it.

### The question is not how smart the agent is

It is **how cheap a mistake is.**

An agent that writes a bad commit costs you one `git reset`. The same agent
sending a bad message to a customer costs you a relationship. Same agent, same
mistake, very different price.

So autonomy is decided per action, by how easily that action is taken back.

### The undo ladder

Every outward action sits somewhere on this ladder. The rule is simple: the
further down, the later you allow it.

| Action | How you undo it | Cost of undoing |
|---|---|---|
| write a file | `git checkout` | nothing |
| commit | `git reset` | nothing |
| push a branch | force push | small, and only yours |
| open a pull request | close it | small, people saw it |
| reply to a review comment | edit it | small, people read it |
| merge to `main` | a revert commit | real, history is public |
| merge to `production` | a revert, then a deploy | large, customers saw it |
| send a message to a person | **you cannot** | you cannot take it back |

The last row is why messaging is the one thing that stays manual longest, even
though it feels smaller than a merge.

### The four levels

**Level 0. Stop at the edge.** Ships in v1.

The agent works freely inside the worktree. It reads, writes, runs tests, and
commits. It stops at the first thing that leaves the machine.

```
agent may        read, write, run tests, commit
agent stops at   push, pull request, message, merge
you do           everything outward
```

**Level 1. Draft and queue.**

Same as level 0, except the agent does not stop dead. It writes what it wants to
send, puts it in a queue, and carries on with anything not blocked by it.

You approve a list in the morning instead of one item at a time.

```
agent may        everything in level 0, plus drafting outward things
you do           approve a queue, not each item
the win          the agent does not sit idle for 8 hours waiting on you
```

**Level 2. Answer its own review.**

The agent replies to review comments it can settle from the code. It still
cannot open a pull request or merge.

```
agent may        reply to a review comment
you do           open the PR, merge
the risk         a comment can be a question, an order, or an opinion.
                 It will misread some.
the brake        it never resolves a thread. You see every reply it posted.
```

**Level 3. Close the loop.**

The agent opens the pull request and merges it.

```
agent may        push, open a PR, merge
you do           read what happened
```

### The gate for each level

You do not turn a level up because it works. You turn it up when you can answer
the question in this table.

| To reach | You must be able to answer |
|---|---|
| Level 1 | how do I see the queue, and reject one item without rejecting all? |
| Level 2 | what stops it replying to a comment it misread? |
| Level 3 | **what makes a change safe to merge with no human?** |

The third question is the real blocker, and it is a team decision. It is not a
setting anyone can write for you.

### Two kinds of rule, and they are not the same

This is the important split. Some things are settings. Some things are not.

**Hard rules. There is no setting.** The code refuses, and no configuration file
can turn it on.

| Rule | Why it is not a setting |
|---|---|
| never merge to `production` | that branch is what customers are running |
| never change its own settings | an agent that can widen its own permission has no permission |
| never touch files outside its own workspace | one mistake must not reach another ticket |

A setting called `"merge": "off"` can be edited by a tired person on a Friday.
A hard rule cannot, because there is nothing to edit.

**Settings. A global default, changeable per workspace.**

| Action | Default in v1 |
|---|---|
| push a branch | `auto` |
| open a pull request | `ask` |
| reply to a review comment | `ask` |
| merge to `main` | `ask` |
| **merge once a human has approved** | `ask` |
| send a message to a person | `ask` |

### Merge once approved is safer than merge

It looks like the same action. It is not.

Plain merge means the agent decided the work was good. Merge once approved means
**a person already said yes**, and the agent only pressed the button after that.

The human is still in the loop. They are just not in it twice.

```
  PR #7651   approved by Vlad at 09:12
             merge once approved is on
             -> merged at 09:12, 4 seconds later
```

That is why it earns `auto` far earlier than plain merge does.

### Rules can also depend on what changed

A global default is still too blunt. Merging a docs change is not the same as
merging a payroll change.

```json
"autonomy": {
  "default": {
    "push":            "auto",
    "openPr":          "ask",
    "replyToReview":   "ask",
    "merge":           "ask",
    "mergeOnApproval": "ask",
    "sendMessage":     "ask"
  },
  "rules": [
    { "when": "onlyPaths(['docs/**','*.md'])", "mergeOnApproval": "auto" },
    { "when": "touchesPaths(['payroll/**'])",  "merge": "off",
                                               "mergeOnApproval": "off" },
    { "when": "kind == 'hotfix'",              "openPr": "ask" }
  ]
}
```

Three values: `auto` does it, `ask` drafts and waits, `off` hides the button.

`off` is a setting you chose. It is not the same as a hard rule, and the screen
says which is which.

### The workspace shows what it is allowed to do

Before anything starts, the start screen lists it plainly. You change any line
for this workspace only, without touching your global defaults.

```
  This workspace will

    push branches                     auto    [ change ]
    open the pull request             ask     [ change ]
    reply to review comments          ask     [ change ]
    merge to main                     ask     [ change ]
    merge once approved               ask     [ change ]
    message people                    ask     [ change ]

  It can never                                (wired in, not a setting)

    merge to production
    change these settings
    touch files outside this workspace
```

Two lists, and the second one has no buttons. That is the point of it.

### The five guardrails

Each one is roughly a day of work. All five exist before level 3 is worth
turning on.

**1. A stop that reaches a running agent.**

Not a button in a window you have closed. A file the agent checks, or a signal
the service sends. `crew stop LMG-1729` must work from any terminal, on any
machine you can reach.

**2. A spending cap.**

Per workspace, and per day across all of them. When it trips, the agent stops
and the workspace says why.

```
LMD-1305   stopped: spending cap, $10.00 of $10.00
```

Without this, one loop costs $200 overnight. The prototype watched one folder
reach $590.64 with a person present.

**3. A time limit.**

An agent that has been working for 3 hours on a 20 minute ticket is stuck, not
productive. Stop it and say so.

**4. A scope fence.**

The agent may only touch files under its own worktree. Not `~`, not another
workspace, not the crew settings. This is checked, not asked for politely.

**5. An audit trail.**

Already free. The journal records every outward action with a timestamp, and
Claude's own transcript records every tool call.

### What you see the morning after

This screen is the whole point of robot mode. Without it, you have handed away
control and got nothing back.

```
  While you were away          6h 14m          $17.00 of $40.00

  LMG-1729    3 commits, PR #7651 opened                 $4.12
              waiting on Sam since 02:14, 5h ago
              [ see the question ]  [ send it ]

  LMD-1305    stopped: spending cap, $10.00               $10.00
              last thing it did: Edit  handler.go:212
              [ see what it did ]  [ raise the cap ]

  PLAT-1640   done. merged at 03:40                        $2.88
              docs only, so it merged itself
              [ see the diff ]

  QA-51       stopped: 3 hours with no progress            $0.00
              last thing it did: Bash  go test ./...
```

Four lines answer everything. What it did. What it cost. Why it stopped. What it
needs from you.

### Where it can never go

Three rules that hold at every level, including level 3. These are wired into
the code. There is no setting for any of them.

1. **It never merges to `production`.** That branch is what customers are
   running.
2. **It never changes its own settings.** An agent that can widen its own
   permission has no permission.
3. **It never touches files outside its own workspace.** One mistake must not
   reach another ticket.

Messaging a person is not on this list. It is a setting, and it starts at `ask`.
It stays the last one anyone should turn to `auto`, because it is the one action
on the undo ladder that cannot be taken back.

### What we build in v1

Level 0, and the settings shape that allows the rest.

That means the `autonomy` block exists from the first commit, with every value
set to `ask`. Raising a level later is changing a default, not rewriting
anything.

Guardrails 4 and 5, the scope fence and the audit trail, also ship in v1. Both
are cheap, and both are worth having even with a person watching.

---

# Part 2: the epics

Ten, in order. Each one leaves crew working, so you can stop after any of them.

Each story below is an outcome, not a build task. Build tasks live under each
story.

**The order comes from evidence, not taste.** We read the first 2,000 commits of
a shipped tool in this space. It built the terminal on day 1, worktrees on day 6,
pull requests in week 1, and the background service on day 32. Its first ticket
integration was day 38. Orchestration was day 43.

So the terminal goes first, because it is the riskiest part and the most visible
one. The background service goes late, because everything works without it.

## Epic 1. A terminal in a window, with an agent in it

### The problem

Everything else rests on this, and it is the part most likely to go wrong.

We own the terminals now. That means drawing them, sizing them, splitting them,
and keeping what they printed. None of it is free any more.

Start anywhere else and you build six epics on top of a piece you have not
proved yet.

### What changes when we ship this

You open crew, pick a folder, and an agent is running in a terminal you can type
into. You split the pane to put a shell beside it. You resize the window and it
redraws.

Nothing about tickets yet. Nothing about worktrees. One agent, one folder, one
window you can actually use.

### The approach

A pseudo terminal per pane. A pseudo terminal is a fake terminal a program
thinks it is talking to.

The layout is a binary tree. Each leaf is a pane with a uuid we minted. The
process id is never the name, because process ids change on restart and then the
saved layout points at nothing.

The terminals live inside the app for now. Closing the window stops them. That
is fine, and it is what a shipped tool in this space did for its first 833
commits.

### What we deliver

1. A pane that draws a real terminal and takes your keystrokes.
2. Splits, in a tree, saved and restored.
3. Resize handled properly, both ways.
4. Scrollback kept on disk, per pane.
5. An agent launched into a pane, with its state read from hooks.
6. The agent's session id recorded, so `claude --resume` works.

### What we are not doing, and why

**The background service.** Everything here works without it. It becomes Epic 8,
once there is something worth keeping alive.

**Windows.** The Mac and Linux library is solid. The pty sits behind one
interface so Windows drops in later.

**Anything about tickets.** A folder is enough to prove the terminal works.

**A settings screen.** Epic 1 only needs to find the `claude` command. Finding
everything, and saying what is missing, becomes Epic 10.

### Risks

**This is the riskiest epic, which is why it is first.** If pseudo terminals,
resize or scrollback do not work, we want to know in week 1, not week 6.

**Scrollback grows.** A busy agent writes megabytes. Cap each pane and drop the
oldest, with the cap in settings.

### Stories

1. A developer opens crew, picks a folder, and sees a working terminal.
2. A developer starts an agent in that terminal and types into it.
3. A developer splits the pane, and the split is still there after a restart.
4. A developer resizes the window and the agent redraws at the new size.
5. A developer scrolls back and sees what the agent printed 10 minutes ago.
6. A developer can resume yesterday's session in that folder.

---

## Epic 2. Start a piece of work

### The problem

Starting work is 6 steps by hand. Make the worktrees. Open a terminal per repo.
Start the agent. Paste the ticket in. Remember the branch name convention.
Remember that a hotfix comes off a different branch.

Every one of those is a chance to get it wrong. The last one ships a fix to the
wrong place.

### What changes when we ship this

You type one thing. crew works out the rest, shows it to you, and lets you
change any of it before anything is created.

### The approach

One input box that takes either a ticket id or a sentence. From either, crew
derives the title, the branch, the workspace name and the base branch. Every
derived field is shown with an edit next to it.

A hotfix is a field on the workspace, not a separate flow. It picks the base
branch and the branch prefix. The git work is the same.

### What we deliver

1. One input that takes a ticket id or a description.
2. The ticket read from Jira, with the title filled in.
3. Branch, workspace name and base branch derived, and editable.
4. An offer to create the Jira ticket when there is not one.
5. Worktrees made by calling git directly.
6. Every step written to the journal as it happens.

### What we are not doing, and why

**Asking an LLM to name the workspace.** A rule turns "Cannot Review Production
Records" into `cannot-review-production-records` in 3 lines. It is instant, free,
and the same every time.

**Guessing which repos to use from the ticket text.** It does not work. LMD-1304
is 3,961 characters and never says `web-client` once. We guess from your own
history instead, and you correct it.

### Risks

**A stale git record blocks the worktree.** Deleting a workspace folder by hand
leaves git still remembering it. crew clears those records for the named repos
and tries once more, then explains plainly if that fails.

### Stories

1. A developer types a ticket id, and crew fills in the title, branch and
   workspace name.
2. A developer types a description instead, and crew offers to create the ticket.
3. A developer can change the branch name and workspace name before anything is
   made.
4. A developer starting a hotfix gets a branch from `production`, not `main`.
5. A developer picks which repos the work may touch, with a first guess from
   their own history.
6. A developer whose folder was deleted by hand can still start, because crew
   clears the stale git record itself.

---

## Epic 3. Ship it

### The problem

The last mile is all manual. Push. Open the pull request. Set the reviewers. Read
the comments. Answer them. Merge. Clean up the worktree.

It fails in confusing ways too. Opening a pull request from `main`, or from a
branch nobody pushed, gives an error that does not say what to do.

### What changes when we ship this

You open the pull request from the window, with reviewers already set. Review
comments appear in the window. The agent answers what it can answer from the
code, and asks you about the rest. You merge, and the workspace closes itself.

### The approach

Seven checks before the button works, each naming the next step. The prototype
checked only 3, and the missing ones are the common failures.

Review comments are read through the same interface as the pull request. The
agent gets them as work, and the rules from Epic 6 apply. It answers what the
code settles, and writes a question for anything else.

### What we deliver

1. Open a pull request, with reviewers from the people on the workspace.
2. Seven checks before the button works: not logged in, uncommitted files, no
   branch, on the default branch, never pushed, nothing to push, already open.
3. Review comments shown in the window.
4. The agent answers comments it can answer from the code.
5. Merge from the window, and mark the workspace done.
6. Remove the worktrees cleanly when the workspace closes.

### What we are not doing, and why

**Merging without you.** A merge is not reversible in the way a commit is.

**Answering a review comment and resolving it silently.** The agent drafts, you
send. Same rule as Epic 6.

### Risks

**A review comment can be a question, an order, or an opinion.** The agent will
misread some. It never resolves a thread, and its replies go out only when you
send them.

### Stories

1. A developer opens a pull request from the window, with reviewers already set.
2. crew refuses to open a pull request for any of 7 named reasons, and says what
   to do.
3. A developer sees review comments in the window, without leaving it.
4. The agent drafts an answer to each comment it can settle from the code.
5. A developer merges from the window, and the workspace is marked done.
6. A developer closes a workspace, and its worktrees are removed cleanly.

---

## Epic 4. What it costs

### The problem

You cannot see what a piece of work cost until the bill arrives, and then it is
one number for everything.

The prototype proved the data is already on disk. One folder held **$590.64**
across 45 files and 45 agents. Nobody could see it.

### What changes when we ship this

The cost of a workspace updates while you watch. You can see which subagent
spent the money. You can see what you spent this week.

### The approach

Claude Code writes every token count to disk as it works. crew reads those files
and adds them up. Nothing is estimated and nothing is stored, because the files
are always right.

### What we deliver

1. Cost per workspace, updating every 2 seconds.
2. Cost per agent and per subagent.
3. A price table per model, in one file.
4. Totals per day, week and month, across every workspace.
5. Cost rolled up from subfolders, so an agent run in `web-api/employees` counts.

### What we are not doing, and why

**A budget that stops an agent.** Useful, and a different feature. Knowing comes
first.

**Storing cost in `workspace.json`.** It is derived. A stored copy goes stale.

### Risks

**Prices change.** The table is one file with a checked date. A model we have
never seen falls back to the highest rate, so we over-count rather than
under-count.

### Stories

1. A developer sees what a workspace has cost, updating while the agent works.
2. A developer sees the cost of each subagent separately, and which model it
   used.
3. A developer sees what they spent today, this week and this month.
4. A developer sees cost from an agent run in a subfolder counted against the
   right repo.

---

## Epic 5. What the agents are doing

### The problem

A terminal tells you what is happening only if you are looking at it. With 3
workspaces open you cannot look at all of them.

Worse, a subagent has no terminal at all. 44 of them ran on one ticket and
nothing showed them.

### What changes when we ship this

You glance at the window and know the state of everything. Which agent is
working. Which is waiting on you. What file it is editing right now.

### The approach

State comes from Claude Code hooks, never from reading the terminal text.

The terminal stream is escape codes and cursor moves. A real capture of 561 bytes
was almost entirely instructions for the screen: turn on bold, move the cursor,
clear to the end of the line. Reading meaning out of that means writing a
terminal emulator.

Subagents come from their own transcript files, and appear as indented rows
under their parent.

### What we deliver

1. Four states per agent: working, idle, blocked, done.
2. The tool an agent is running now, and what it is running it on.
3. Subagents as rows, with state, model and cost.
4. The last thing an agent said, without opening the terminal.
5. A short history of what the agent did, from the journal and the transcript.

### What we are not doing, and why

**Reading state from the terminal text.** It breaks on every version change, and
it cannot see a subagent at all.

### Risks

**Hooks are per agent tool.** Claude Code has them. Another tool might not. The
fallback is that the state shows as unknown, rather than wrong.

### Stories

1. A developer sees whether each agent is working, idle, blocked or done.
2. A developer sees the tool an agent is running right now, and on which file.
3. A developer sees every subagent as a row under its parent, with its own cost.
4. A developer sees the last thing an agent said, without opening the terminal.

---

## Epic 6. The agent asks a question

### The problem

An agent hits a product decision it cannot answer from the code. Today it
guesses, and you find out in review.

The alternative is worse. An agent that can message people will message a real
person at 2am with a half formed question.

### What changes when we ship this

The agent stops instead of guessing. You see a clear sign that a workspace is
waiting on you. You read the exact message before anything is sent.

### The approach

The agent writes its question to a file and stops. It has no way to message
anyone, and the prompt tells it so plainly.

crew shows the question and the exact message. You edit it, send it, or throw it
away. Nothing leaves the machine without a click.

### What we deliver

1. A prompt that tells the agent to write a question and wait.
2. A clear sign on the workspace that it needs you.
3. The question and the exact outgoing message, side by side.
4. Send, edit, discard, or leave it for later.
5. A record of what was sent, and when.

### What we are not doing, and why

**Letting the agent send anything by itself.** Not in v1. It can message a real
person, and you cannot take that back.

### Risks

**People ignore the sign and the agent sits idle.** A notification, and a count
on the workspace list that cannot be missed.

### Stories

1. An agent that is stuck writes a question and stops, instead of guessing.
2. A developer sees a clear sign that a workspace is waiting on them.
3. A developer reads the question and the exact message before anything is sent.
4. A developer edits or discards the message instead of sending it.
5. A developer sends it, and can see later what was sent.
6. An agent names which role should answer, so the question goes to the right
   person.
7. A developer can set any outward action to ask or auto, and v1 ships every one
   set to ask.

---

## Epic 7. Many workspaces

### The problem

Everything so far is one workspace. The reason this tool exists is to run
several.

With 4 open, the question is not "what is this agent doing". It is "which one
needs me right now".

### What changes when we ship this

One screen answers that. You see every workspace, sorted so the ones that need
you are first.

### The approach

A list, not a grid of terminals. Each row is a workspace with its state, its
cost, and what it is waiting on. Clicking one opens it, with its layout exactly
as you left it.

Switching workspaces swaps the whole pane tree. Your arrangement comes back.

### What we deliver

1. Every workspace in one list, with state and cost.
2. Sorted so anything waiting on you is at the top.
3. Switch between workspaces without losing any layout.
4. A notification when something you were waiting for finishes.
5. Totals across every workspace, for the day and the week.
6. A report of what happened while you were away.

### What we are not doing, and why

**Several workspaces on screen at once.** One at a time, switched fast. Two live
terminals side by side is a later thing, and it costs a pane per agent.

### Risks

**The list gets slow with many workspaces.** Cost is read from files on every
poll. Read only folders that changed, and cache the rest.

### Stories

1. A developer sees every workspace, with its state and cost.
2. A developer sees at a glance which workspaces need them.
3. A developer switches between workspaces without losing any layout.
4. A developer is told when something they were waiting for finishes.
5. A developer who has been away sees one report of what every agent did, what
   it cost, and why each one stopped.

---

## Epic 8. It survives the window closing

### The problem

An agent takes 40 minutes on a real ticket. You will close the window in that
time. Today that kills it.

Everything up to here works, and this is the upgrade that makes it usable all
day.

### What changes when we ship this

You close the window, go to lunch, and come back. The agent kept working. The
terminal is where you left it, with everything it printed.

### The approach

A small background service owns every pseudo terminal. The window connects to it
and owns no process. Closing the window disconnects. It does not kill anything.

This is deliberately late. A shipped tool in this space ran everything inside the
app for 833 commits and 32 days before moving it out. Doing it that way means
the service is an upgrade, not a foundation you have to get right on day one.

### What we deliver

1. A background service that owns the pseudo terminals.
2. The window reattaches to a running session on open.
3. Scrollback survives the window closing.
4. `crew attach <workspace>` from a plain terminal.
5. The service restarts itself if it dies while agents are running.

### What we are not doing, and why

**Making the service understand tickets or cost.** Its whole job is to keep
processes alive and pass bytes. A service that understands tickets is a service
you restart whenever ticket handling changes.

**Surviving a reboot.** Nothing survives a reboot. The journal is what brings you
back, and it already works.

### Risks

**The service is the largest single piece of new code in the whole plan.** It has
to start, stay alive, be found by the window, and survive the window crashing.

The mitigation is that everything already works without it. If it turns out badly
we can ship the other nine epics and come back.

### Stories

1. A developer closes the window and the agent keeps working.
2. A developer reopens the window and sees the same terminal, with its
   scrollback.
3. A developer can attach to a running workspace from a plain terminal.
4. A developer whose service died sees crew start it again, and say so.

---

## Epic 9. Workers

### The problem

One agent on one ticket is the common case. Some work is genuinely two separate
jobs, and doing them one after the other wastes time.

But two agents that cannot talk to each other make conflicting decisions. That is
what the prototype did, and it cost $2.71 to learn.

### What changes when we ship this

A lead agent can start a worker in its own worktree, with its own terminal, for
work that truly does not need to agree with anything else.

You see every worker, what it is doing, and what is blocking it.

### The approach

A run holds tasks. A task is dispatched to a worker. The worker reports back.

One rule matters most: a worker reports done **once**, carrying both the task id
and the dispatch id. That stops a slow retry from marking the wrong attempt
finished.

Task dependencies form the graph. The journal stays a flat list.

### What we deliver

1. A run, with tasks that can depend on other tasks.
2. Start a worker for a task, in its own worktree.
3. Six task states: pending, ready, dispatched, completed, failed, blocked.
4. A worker reports done exactly once, with both ids.
5. See every worker, its task, and what it is doing.
6. Stop a worker without stopping the lead.

### What we are not doing, and why

**Letting the lead start workers without telling you.** It proposes the split and
says why. You approve it.

**Workers on another machine.** A much bigger thing.

### Risks

**This is the epic most likely to be cut.** Subagents already handle most
parallel work, inside one process, for free. Workers earn their cost only when
two pieces of work truly do not need to agree.

### Stories

1. A lead agent can propose a split, and a developer approves it.
2. A lead agent can start a worker in its own worktree.
3. A developer sees every worker, its task, and what it is doing.
4. A worker reports back exactly once, with its task and dispatch id.
5. A developer sees which tasks are blocked, and on what.
6. A developer can stop a worker without stopping the lead.

---

## Epic 10. Someone else can use it

### The problem

Everything so far works on one machine, with one person's folder layout, one
person's tools, and one person's habits.

The prototype needed a personal script at `~/dev-setup/bin/ws`. Nobody else has
that.

### What changes when we ship this

A teammate installs crew and it works. Their folders are different, and crew
finds them. Their tools are different, and crew uses what they have.

### The approach

Nothing personal in the code. Every path is a setting with a discovered default.
Every integration has an off state.

Windows lands here, because the pty interface from Epic 3 already allows it.

### What we deliver

1. `crew doctor`, in the window and on the command line, naming every tool it
   found and whether it is logged in.
2. A settings file at `~/.crew/settings.json`, readable and editable by hand.
3. Keys for Jira, chat and the git host, stored with file mode 600.
4. Layout discovered from what is already on their disk, and correctable.
5. Features hidden when their integration is not set up.
6. An installer, and a first run that needs no personal scripts.
7. Profiles that can be exported and imported, so a team shares skills.
8. Windows support.
9. A README a new person can follow alone.

### What we are not doing, and why

**Publishing it outside PickTrace.** Later, and a separate decision.

### Risks

**Windows has the weakest pty support of the three platforms.** `node-pty` is
Microsoft's and ships in VS Code, so this risk is much smaller in TypeScript than
it would have been in another language.

### Stories

1. A developer runs `crew doctor` and sees every tool, its version, and whether
   it is logged in.
2. A developer with nothing configured still gets a working app, with the
   unconfigured features hidden.
3. A developer can enter Jira, chat and git host keys, and crew says whether they
   work.
4. A new person's different folder layout is discovered, not imposed.
5. A new person installs crew and it works, with no personal scripts.
6. A developer exports a profile, and a teammate imports it.
7. crew runs on Windows.

---

# Part 3: what is still open

| Topic | Why it is not settled |
|---|---|
| The UI in detail | screens sketched, not drawn |
| Where daily and weekly totals are stored | needs Epic 4 started |
| Notifications: where and how loud | needs Epic 8 |
| Whether Epic 9 is worth building | decide after Epic 5 ships |
| References and prior art | gather once the design is done |
