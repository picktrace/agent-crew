# The state model

Three tiers, split by what survives a restart.

## Tier 1: durable

Written to disk. Survives a crash, a reboot, anything.

```ts
type Workspace = {
  id: string            // "LMG-1729". The ticket. Also the branch name.
  createdAt: string
  repos: Repo[]
  layout: LayoutNode    // the tree of splits
  panes: PaneRecord[]   // what each pane is for
}

type Repo = {
  name: string          // "web-api"
  path: string          // ~/workspaces/LMG-1729/web-api
  branch: string        // "LMG-1729"
}

type LayoutNode =
  | { kind: 'leaf';  paneId: string }
  | { kind: 'split'; dir: 'row' | 'col'; ratio: number;
      first: LayoutNode; second: LayoutNode }

type PaneRecord = {
  paneId: string            // ours. a uuid. never an operating system id.
  role: 'agent' | 'shell' | 'diff' | 'logs'
  cwd: string
  agentSessionId?: string   // set once the agent has replied at least once
  title?: string
}
```

### Why paneId is ours, not the operating system's

If a pane is named by its process id, every restart gives it a new name. The
saved layout then points at nothing.

So we mint a uuid when the pane is made. The process id is something the live
pane carries, and it is thrown away on restart.

Orca learned this the hard way. Their code says the key must use "the durable
terminal-layout leaf UUID instead of the renderer-local numeric PaneManager id".

## Tier 2: live

Exists only while the service runs. Not written to disk, except scrollback.

```ts
type LivePane = {
  paneId: string        // matches the record above
  pid: number           // the operating system process
  pty: IPty             // the node-pty handle
  cols: number
  rows: number
  scrollback: Buffer    // we own the bytes, so we keep them
}
```

## Tier 3: derived

Read fresh every time. **Never written to `workspace.json`.**

| What | Read from |
|---|---|
| tokens and cost | the Claude JSONL transcript files |
| agent state: working, idle, blocked | Claude Code hooks |
| current tool and its input | the same hooks |
| subagents, and what each is doing | the subagent JSONL files |
| repo dirty, commits ahead | `git status`, `git rev-list` |
| is a pull request open | the forge API |

The rule: if it can be derived, derive it. Stored copies go stale. Derived
answers are always right.

## Where it lives on disk

One folder per workspace. Delete the workspace and everything goes with it.

```
~/workspaces/LMG-1729/.crew/
  workspace.json      tier 1
  journal.jsonl       append only, never edited
  scrollback/
    a7f2.bin          one per pane
  prompts/
    lead.md           what the agent was told to read
```

No database. You can open any of these in an editor and read them.

## The journal

One line per thing that happened. Written the moment it happens.

```json
{"at":"...","what":"worktree_added","repo":"web-api"}
{"at":"...","what":"pane_opened","paneId":"a7f2","role":"agent"}
{"at":"...","what":"agent_session","paneId":"a7f2","sessionId":"d49d46ca-..."}
{"at":"...","what":"layout_changed","value":{}}
{"at":"...","what":"pr_opened","repo":"web-client","url":"..."}
```

It answers two questions. Where was I when it crashed. And what happened, in
order.

Claude Code already journals the agent side. One real session held 1,745
timestamped entries. It knows nothing about what agent-crew did, so we
write our own.

## The three things that live in a workspace

```
Workspace                  one ticket
 |- repos[]                worktrees, all on branch LMG-1729
 |- layout + panes[]       terminals we own
 |- lead agent session     one conversation
 |   |- subagents[]        children inside it. no terminal. rows in a list.
 |- workers[]              later. separate agents, own worktree, own terminal.
```

**A subagent is not a terminal.** One real session spawned 44 subagents inside 1
process, using 0 extra terminals. They are rows in a list.

**A worker is a terminal.** That is the orchestration layer, and it comes later.
