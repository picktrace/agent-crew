# Evidence

Every number in these documents, and the command that produced it.

No claim in this design should be taken on trust. If a number here is wrong, the
decision it supports is wrong too, and `docs/decisions.md` says which one.

Measured on 2026-09-16, on a macOS machine with the PickTrace repos at
`~/repos/picktrace`.

---

## From the prototype's own token records

### One reply is written on several lines. The bill reads 2.50 times too high.

Supports **the cost reader design** in Epic 4.

```bash
python3 - <<'PY'
import json, glob, os, collections
f = sorted(glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl")),
           key=os.path.getmtime)[-1]
byreq = collections.defaultdict(list)
for line in open(f):
    try: d = json.loads(line)
    except: continue
    u = d.get("message", {}).get("usage")
    if d.get("type") != "assistant" or not u: continue
    byreq[d.get("requestId")].append(u.get("output_tokens"))
naive = sum(v for vs in byreq.values() for v in vs)
dedup = sum(vs[0] for vs in byreq.values())
print(f"requests {len(byreq)}  naive {naive}  deduped {dedup}  {naive/dedup:.2f}x")
PY
```

Result on the session that was live at the time:

```
86 assistant lines, 44 requests
output tokens  naive=98584  deduped=39400  overcount=2.50x
```

**The rule.** Keep one line per `requestId`. Never add up every line.

### Lines marked `<synthetic>` are not real API calls

```bash
python3 - <<'PY'
import json, glob, os
n = nz = 0
for f in glob.glob(os.path.expanduser("~/.claude/projects/*/*.jsonl")):
    for line in open(f, errors='ignore'):
        if '<synthetic>' not in line: continue
        try: d = json.loads(line)
        except: continue
        if d.get('message', {}).get('model') != '<synthetic>': continue
        u = d.get('message', {}).get('usage')
        if not u: continue
        n += 1
        if sum(u.get(k, 0) or 0 for k in
               ('input_tokens','output_tokens','cache_read_input_tokens',
                'cache_creation_input_tokens')): nz += 1
print(f"synthetic lines with usage: {n}, of those with tokens: {nz}")
PY
```

Result: **40 lines, 0 with tokens.** Claude Code writes these itself.

### The transcript folder name is not reversible

Supports **the cost roll-up design** in Epic 4.

```
/code/web-api/employees     ->  -Users-you-code-web-api-employees
/code/web-api-device-sync   ->  -Users-you-code-web-api-device-sync
```

Both start with the same text. Only the first is really inside `web-api`.

**The rule.** Read the real path out of the `cwd` field in the file. Never match
on the folder name.

### The folder name rule itself holds, 21 of 21

```bash
python3 - <<'PY'
import os, json, glob
base = os.path.expanduser("~/.claude/projects")
m = d = 0
for slug in sorted(os.listdir(base)):
    p = os.path.join(base, slug)
    files = glob.glob(p + "/*.jsonl") + glob.glob(p + "/*/subagents/*.jsonl")
    if not files: continue
    cwd = None
    for line in open(files[0]):
        try: cwd = json.loads(line).get("cwd")
        except: continue
        if cwd: break
    if not cwd: continue
    if cwd.replace("/", "-") == slug: m += 1
    else: d += 1
print("match:", m, "differ:", d)
PY
```

Result: **match 21, differ 0.**

### One session, 44 subagents, 0 extra terminals

Supports **D-10, one ticket one lead agent**.

```bash
D=~/.claude/projects/-Users-chaitanyavemprala-code-web-api-device-sync
echo "main sessions : $(ls $D/*.jsonl | wc -l)"
echo "subagent files: $(ls $D/*/subagents/*.jsonl | wc -l)"
```

Result: **1 main session, 44 subagent files.** No tmux session ever existed for
it, so those 44 ran inside one process with no terminal of their own.

### $590.64 was already on disk, unseen

The cost reader was checked against an independent count written in Python. Both
agreed exactly.

```
files: 45   tokens: 740,573,246   dollars: $590.64   agents: 45
```

### Two agents on one ticket cost $2.71

Supports **D-10**.

```
LMG-1729                         $2.71     2.7M
  web-api                      stopped  $1.67   1.7M
  web-client                   stopped  $1.04   1.0M
```

Both read the same ticket separately. Neither knew what the other decided.

---

## From the PickTrace repos

### 40 percent of merged branches have no ticket

Supports **D-11, a workspace is not a ticket**.

```bash
git -C ~/repos/picktrace/web-api log origin/main --merges -25 --format='%s' \
  | sed -E 's|.*from picktrace/||'
```

Result: 25 branches, **10 with no ticket id**.

| Pattern | Count |
|---|---|
| `TICKET-NNNN-slug` | 11 |
| plain slug | 8 |
| `task/slug` | 3 |
| `fix/TICKET` | 1 |
| `hotfix/slug` | 1 |

### A hotfix branches from `production`

Supports **D-12**.

```bash
R=~/repos/picktrace/web-api
git -C $R rev-parse fa5ea6086^          # the parent of a hotfix commit
git -C $R merge-base --is-ancestor <parent> origin/production && echo "on production"
git -C $R for-each-ref --sort=-creatordate --format='%(refname:short)' refs/tags \
  | grep hotfix | head -5
```

Result: the parent was on `production`. **5 hotfix tags in 2 weeks.**

`production` is cut from `main` every Monday to Thursday at 4pm, per the user.

### git already knows the folder layout

Supports **the layout discovery design** in Epic 10.

```bash
git -C ~/repos/picktrace/web-api worktree list
git -C <any worktree> rev-parse --git-common-dir
```

So crew discovers a person's layout instead of imposing one.

---

## From this machine

### tmux is not on a fresh Mac. git is.

Supports **D-04, we own the terminals**.

```bash
ls /usr/bin/tmux   # No such file or directory
ls /usr/bin/git    # /usr/bin/git
which tmux         # /opt/homebrew/bin/tmux, installed by brew
```

tmux also does not run on Windows at all. Only inside WSL.

### Terminal bytes are cursor moves, not meaning

Supports **the "state from hooks" rule** in Epic 5.

```bash
tmux -L demo new-session -d -s S
tmux -L demo pipe-pane -t S -O "cat >> /tmp/cap.txt"
tmux -L demo send-keys -t S "echo hello" Enter
cat -v /tmp/cap.txt
```

Result: **561 bytes** for one `echo`. Almost all of it is instructions for the
screen:

```
^[[1m^[[7m%^[[27m^[[1m^[[0m   ^M ^M^[k~/repos^[\^[]7;file://...
```

### tmux can return full scrollback, and restore a layout

These were checked because they were arguments *for* tmux. Both worked. D-04 was
still decided against it, on Windows alone.

```bash
tmux capture-pane -p -S - -t <pane>    # 503 lines of history
tmux select-layout -t <window> 'cb67,253x52,0,0{...}'   # restores every size
```

### Slack already knows a person's role

Supports **D-17, people by role**.

```bash
slackcli search people "Vlad" --limit 1 --json
```

Result:

```json
{ "id": "USG2VBM60",
  "profile": { "real_name": "Vladimir Mokshin", "title": "Engineering" } }
```

### The pty library comparison

Supports **D-05**.

```bash
gh api repos/microsoft/node-pty --jq '.stargazers_count'
gh api repos/creack/pty --jq '.stargazers_count'
gh api repos/aymanbagabas/go-pty --jq '.stargazers_count'
```

| Language | Library | Stars | Windows |
|---|---|---|---|
| TypeScript | `node-pty` | 2,027 | yes, ships in VS Code |
| Go | `creack/pty` | 2,093 | no |
| Go | `aymanbagabas/go-pty` | 84 | yes |

---

## From 11,089 commits of a shipped tool in this space

Read on 2026-09-16 with a metadata-only clone. The clone is 90 MB.

```bash
git clone --bare --filter=blob:none --no-tags <repo> orca.git
git -C orca.git rev-list --count HEAD        # 11089
git -C orca.git log --reverse --format='%ad|%s' --date=short
```

### The build order

Supports **D-16, the terminal is Epic 1**, and **D-09, the service comes late**.

```
#4     day 1    Basic terminal support
#54    day 4    first merged pull request
#89    day 6    Windows build
#91    day 6    worktree dialog
#197   day 10   editable diff views
#551   day 25   Codex usage tracking
#834   day 32   terminal persistence via out-of-process daemon
#1088  day 38   Linear integration, its first ticket system
#1276  day 43   inter-agent orchestration
```

The first 1,000 commits took 36 days. **40 percent of them were fixes.**

### What a mature version spends its time on

Supports **D-16**, and the warning that Epic 1 is not a week.

Per 1,000 commits, its middle phase against its mature phase:

| Topic | middle | mature | |
|---|---|---|---|
| performance | 82 | 179 | more than doubled |
| tests | 24 | 86 | tripled |
| sessions and restore | 36 | 68 | nearly doubled |
| terminal and pty | 126 | 149 | still growing |
| pull requests | 97 | 32 | finished |

### The problems it hit after shipping

Supports **What breaks at scale** in `docs/architecture.md`.

| Count | Problem |
|---|---|
| 65 | moving a timer out of a view effect |
| 31 | cutting the cost of watching files |
| 24 | replacing guessed agent state with explicit markers |
| 10 | pulling things back out of the durable state file |
| 7 | pty output buffering |
| 3 | a service that was alive but stuck |

Ten commits that took things back out of a state file that had already shipped:

```
Persist terminal scrollback outside session JSON
replace per-5s full-buffer terminal checkpoints with an incremental log (#5292)
Move githubCache out of the durable state file into a quit-time sidecar (#7101)
compact JSON for durable-state save payload (drop pretty-print) (#9290)
stop full durable-state save on every top-level view switch (#9393)
```

### 48 listeners per pane

```
perf(terminal): cut per-pane store listeners from 48 to 17 (#18322)
```

### Lint rules named after their own bugs

Supports the practice recommended in `docs/architecture.md`.

```bash
gh api repos/<repo>/contents/config/oxlint-plugins --jq '.[].name'
```

Five plugins. One of them:

```
quadratic-buffer-concat.mjs

  "Buffer.concat rebuilds loop-carried X;
   collect chunks and concatenate once after the loop."
```

---

### Reference numbers from a shipped terminal

**These are not our budgets. We have not measured anything yet.**

A shipped tool in this space checks these in its build, and fails when one is
exceeded. They tell us two things: which numbers are worth measuring, and what
order of magnitude counts as good.

```
maxMedianKeyLatencyMs           75
maxWorstKeyLatencyMs           300
maxRevisitLatencyMs            300
maxScrollLatencyMs             150
maxRestoreLatencyMs           1000
maxTimerDriftMs                150
maxTimerDriftUnderLoadMs      3500
maxRendererQueuedChars     2097152
maxRendererPeakQueuedChars 2097152
maxRendererDroppedBacklogs       0
```

```bash
gh api repos/<repo>/contents/config/scripts/check-terminal-perf-report-budgets.mjs \
  --jq '.content' | base64 -d | grep -A12 'const BUDGETS'
```

The last line is the one to read twice. `maxRendererDroppedBacklogs: 0` is not a
speed budget. Dropping output is a correctness bug, and the only acceptable
count is none.

**How we will use these.** As a sanity check, once. If our first measurement of
median key latency is 400 ms and a shipped terminal does 75 ms, that gap is a
bug to find. It is not a number to accept and write down.

Our own budgets come from our own runs, after the gap is closed. Epic 1 in
`docs/plan.md` has the metric definitions and the three scenarios.

---

## What we have not measured

Honest gaps. Each one is a claim in the design that rests on judgment, not a
number.

| Claim | Why it is not measured |
|---|---|
| Electron costs 150 to 400 MB of memory | taken from published comparisons, not run here |
| Go would be 15 MB, Rust 3 MB | same |
| A journal costs about 60 lines | an estimate, no code exists |
| Each guardrail is about a day | an estimate |
| 4 roles is the right set for people | a guess. D-17 says so |
| The 10 epics are correctly sized | no epic has been built |
| Any performance number for our own terminal | no terminal exists yet. Epic 1 story 7 measures it |
