# Decisions

Every decision, in one place, in a form you can check.

Each entry has the same parts. The one that matters most is **the fact that
decided it**. A decision is only as good as the fact behind it. Write the fact
down, and anyone can go and see whether it is still true.

**Status** is one of:

- `firm` we would need new evidence to change it
- `soft` reasonable, but we have not tested it

Last updated: 2026-09-16. No code has been written.

---

## D-01 Rewrite, do not patch the prototype

**Decided** 2026-09-16 &middot; **firm**

**Chose.** Throw away `~/code/dowork`, about 2,600 lines, and start again.

**Rejected.** Keep patching it.

**The fact that decided it.** The prototype proved the idea and disproved its own
design. It ran one agent per repo, and it had no state model. Three separate
parts had to be rewritten in one afternoon.

**What would change our mind.** Nothing. The prototype's findings are kept in
`docs/plan.md`. The code is not.

**What it costs.** Everything starts from zero.

---

## D-02 Called agent-crew, the command is `crew`

**Decided** 2026-09-16 &middot; **firm**

**Chose.** Repo `agent-crew`. Command `crew`.

**Rejected.** `dowork`, `agent-workbench`, `agent-desk`, `ticket-runner`.

**The fact that decided it.** A crew is people working together on one job, which
is what the tool runs. The org uses lowercase hyphenated names such as
`release-bot` and `command-center`, so it fits.

**What would change our mind.** `crew` already means a group of farm workers at
PickTrace. 256 Go files in `web-api` mention it. If that collision confuses
people in practice, `bench` has none.

**What it costs.** One word means two things. The repo name carries the
disambiguation where it matters.

---

## D-03 TypeScript and Electron

**Decided** 2026-09-16 &middot; **firm**

**Chose.** TypeScript, Electron, React, xterm.js.

**Rejected.** Go with Wails. Rust with Tauri. Go with plain JavaScript.

**The fact that decided it.** The people at PickTrace who would contribute are
frontend people. A tool nobody helps with is a tool that dies.

**What would change our mind.** If this stops being a team tool and becomes a
personal one, Go wins on every technical count.

**What it costs.** 306 MB on disk. 150 to 400 MB of memory. Go would be 15 MB.
Rust would be 3 MB with a 380 ms start.

**Note.** A Go version will exist as a separate personal project.

---

## D-04 We own the pseudo terminals. No tmux.

**Decided** 2026-09-16 &middot; **firm**

**Chose.** crew starts and owns each pseudo terminal itself.

**Rejected.** Run everything inside tmux. tmux gives four things for free: a
background service, the split layout as one string, full scrollback, and attach
from any terminal.

**The fact that decided it.** tmux does not run on Windows. Only inside WSL. And
it is not on a fresh Mac, so every user would install it first.

```
$ ls /usr/bin/tmux
ls: /usr/bin/tmux: No such file or directory
$ ls /usr/bin/git
/usr/bin/git
```

**What would change our mind.** If Windows is never a target, tmux wins on every
other count and saves about 2 weeks.

**What it costs.** A background service, a layout tree, and scrollback keeping.
All three are now Epic 1 and Epic 8.

---

## D-05 `node-pty` for pseudo terminals

**Decided** 2026-09-16 &middot; **firm**

**Chose.** `node-pty`.

**Rejected.** Nothing, once D-03 chose TypeScript.

**The fact that decided it.** 2,027 stars, maintained by Microsoft, and it ships
inside VS Code. That makes it the most tested code of its kind, especially on
Windows.

**Why it is worth recording.** In Go, the only cross-platform option had 84 stars
and 9 forks. D-03 removed a real risk as a side effect, not as its reason.

---

## D-06 macOS and Linux first. Windows later.

**Decided** 2026-09-16 &middot; **soft**

**Chose.** Ship for Mac and Linux. Keep the pty behind one interface so Windows
drops in later.

**The fact that decided it.** Nobody on the team runs Windows today. D-04 already
keeps the door open, so delaying costs nothing.

**What would change our mind.** One person on Windows who wants to use it.

---

## D-07 One JSON file per workspace

**Decided** 2026-09-16 &middot; **firm**

**Chose.** `~/workspaces/<id>/.crew/workspace.json`, plus `journal.jsonl` beside
it. No database.

**Rejected.** SQLite for everything.

**The fact that decided it.** You can open it in an editor and read it. Deleting
the workspace folder deletes everything with it. There are no migrations.

**What would change our mind.** A question we cannot answer without a query, such
as "show me every blocked agent across 40 workspaces". If that gets slow, a small
index comes first. A database only after that.

**What it costs, and the guard.** A tool in this space chose the same thing, then
spent 10 commits taking things back out of that file. The rules are in
`docs/architecture.md` under **What breaks at scale**. No scrollback. No caches.
Nothing written every few seconds. Never pretty printed.

---

## D-08 An append only journal, not a service, is how we recover

**Decided** 2026-09-16 &middot; **firm**

**Chose.** One line per thing that happened, written the moment it happens. A
whole ticket is about 13 lines.

**The fact that decided it.** There are three ways things die, and a service only
helps with the first.

| What dies | agents survive |
|---|---|
| the crew window | yes |
| the service | no |
| the machine reboots | no |

A service does not survive a reboot. Knowing where you were does.

**Shape.** A flat list, not a graph. `causedBy` is an optional field, so you can
follow a chain when you need one. The dependency graph lives in the task model.

**What it costs.** About 60 lines.

---

## D-09 The background service comes late, at Epic 8

**Decided** 2026-09-16 &middot; **firm** &middot; changed the epic order

**Chose.** Terminals live inside the app until Epic 8. Closing the window stops
them until then.

**Rejected.** Build the service first, as a foundation.

**The fact that decided it.** A shipped tool in this space ran everything inside
the app for its first **833 commits and 32 days**.

```
#834  2026-04-17  feat: terminal persistence via out-of-process daemon (#729)
```

**What would change our mind.** Nothing. This order makes the service an upgrade
rather than a blocker. If it goes badly we ship the other nine epics.

---

## D-10 One ticket, one lead agent

**Decided** 2026-09-15 &middot; **firm**

**Chose.** One agent per ticket. It sits at the workspace root, and every repo is
a folder below it. It decides for itself whether to split the work.

**Rejected.** One agent per repo, which the prototype did.

**The fact that decided it.** LMG-1729 spent **$2.71** with two agents. Both read
the same ticket separately. Neither knew what the other had decided.

**What would change our mind.** Nothing. A subagent already handles parallel work
inside one process. One real session spawned **44 subagents** using **0 extra
terminals**.

---

## D-11 A workspace is not a ticket

**Decided** 2026-09-16 &middot; **firm**

**Chose.** Four separate fields. `id` for the folder, `branch` for git, `ticket`
optional, `title` for reading.

**Rejected.** One string used for all four, which the prototype did.

**The fact that decided it.** Of the last 25 merged pull requests in `web-api`,
**10 had no ticket id at all**. That is 40 percent.

```
task/qc-forms-device-sync          no ticket
checkpoints-raw-query-context      no ticket
changelog-group-by-date            no ticket
go-db-db-spans-wave-1              no ticket
```

**What would change our mind.** Nothing. A workspace cannot require a ticket.

---

## D-12 A hotfix branches from `production`

**Decided** 2026-09-16 &middot; **firm** &middot; corrected by the user

**Chose.** `kind: 'hotfix'` changes the base branch and the branch prefix. The
git work is otherwise the same.

```ts
const base = kind === 'hotfix' ? 'origin/production' : 'origin/main'
```

**Rejected.** An earlier reading of the graph that said hotfixes branch from
`main`.

**The fact that decided it.** `production` is cut from `main` every Monday to
Thursday at 4pm. The parent of hotfix commit `fa5ea6086` was on `production` at
the time. There were **5 hotfix tags in 2 weeks**, so this path is common.

**Still open.** How a hotfix reaches `production` after it merges to `main`.

---

## D-13 Nothing is required. Every integration has an off state.

**Decided** 2026-09-16 &middot; **firm**

**Chose.** Three states per integration. Not configured hides the feature. A
command line tool is used when present. Keys beat a command line tool.

**The fact that decided it.** The prototype needed a personal script at
`~/dev-setup/bin/ws`. Nobody else has that. A tool that assumes one person's
machine cannot be given away.

---

## D-14 Hard rules are not settings

**Decided** 2026-09-16 &middot; **firm** &middot; the user drew this line

**Chose.** Two kinds of rule.

Hard, wired into the code, with no setting at all: never merge to `production`,
never change its own settings, never touch files outside its workspace.

Settings, with a global default and a per workspace override: push, open a pull
request, reply to a review, merge, merge once approved, send a message.

**Rejected.** One setting per action, with `never` as a value for the dangerous
ones.

**The fact that decided it.** A setting can be edited by a tired person on a
Friday. A hard rule cannot, because there is nothing to edit.

---

## D-15 v1 ships robot mode level 0

**Decided** 2026-09-16 &middot; **firm**

**Chose.** The agent works freely inside the worktree, and stops at the first
thing that leaves the machine. The `autonomy` block exists from the first commit,
with every value set to `ask`.

**Rejected.** Shipping any autonomy. Also rejected: leaving the settings out.

**The fact that decided it.** Raising a level later must be changing a default,
not rewriting anything.

**What would change our mind.** Level 3 needs a rule for when a merge is safe
with no human. That is a team decision, not a setting.

---

## D-16 The terminal is Epic 1, not Epic 3

**Decided** 2026-09-16 &middot; **firm** &middot; reordered all 10 epics

**Chose.** Epic 1 is a terminal in a window with an agent in it.

**Rejected.** Starting with settings and worktrees, which was the original order.

**The fact that decided it.** A shipped tool in this space wrote "Basic terminal
support" as its **fourth commit, on day one**. Worktrees came on day 6. Its first
ticket integration was day 38.

It also never stopped. Per 1,000 commits, terminal work went from 126 in its
middle phase to 149 in its mature phase. Pull request work fell from 97 to 32.

**What would change our mind.** Nothing. The terminal is the riskiest part, and
we want to know in week 1 rather than week 6.

---

## D-17 People are stored by role, not just by name

**Decided** 2026-09-16 &middot; **soft** &middot; the user asked for this

**Chose.** You type a name. crew searches Slack and stores the id and the role.
The agent is told who decides what, by role.

**Rejected.** Typing a Slack id by hand, which the prototype did.

**The fact that decided it.** Slack already knows. Searching for "Vlad" returns
the id and the title in one call.

```json
{ "id": "USG2VBM60",
  "profile": { "real_name": "Vladimir Mokshin", "title": "Engineering" } }
```

**What would change our mind.** Whether four roles is the right set. Product, QA,
engineering and design is a guess.

---

## D-18 One repo, flat, on this machine first

**Decided** 2026-09-16 &middot; **soft**

**Chose.** `~/code/agent-crew`. One repo, flat layout, not in the picktrace org
yet.

**Rejected.** The org repo from day one. Two repos, one for the engine and one
for the app.

**The fact that decided it.** The user's call. The design should settle before
other people read it.

**What would change our mind.** The reason for D-03 was that people can
contribute. They cannot contribute to a repo they cannot see. Moving it to the
org is worth doing once the epics are agreed.

**The guard that makes flat work.** Every Electron call lives in one file. Nothing
else imports Electron. The engine must run from the command line with no window
open. That rule is the test that the layers hold.

---

# What is not decided

| Question | Waiting on | Blocks |
|---|---|---|
| How a hotfix reaches `production` after merging to `main` | the user | Epic 3 |
| The UI in detail. Screens are sketched, not drawn | a design session | Epics 1, 5, 7 |
| Where daily and weekly totals are stored | Epic 4 starting | Epic 4 |
| Whether Epic 9, workers, is worth building at all | Epic 5 shipping | Epic 9 |
| Whether the repo moves to the picktrace org | the user | nothing yet |
| How the window and the service talk | Epic 8 | Epic 8 |

---

# What changed during the design, and why

Four reversals. Each one was caused by one new fact.

| Was | Became | The fact that turned it |
|---|---|---|
| Go with Wails | TypeScript with Electron | who will contribute |
| tmux | we own the terminals | tmux does not run on Windows |
| one agent per repo | one lead agent | $2.71 on one ticket, read twice |
| settings first, terminal third | terminal first | their commit 4, on day 1 |

A design that never reverses has not been tested against anything.
