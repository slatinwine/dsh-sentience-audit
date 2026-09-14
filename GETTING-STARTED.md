# Getting started

From nothing to a real audit result: install the plugin, ask the agent to run
the tool, read the level.

- [1. What you get](#1-what-you-get)
- [2. Requirements](#2-requirements)
- [3. Install](#3-install)
- [4. Run it](#4-run-it)
- [5. Read the result](#5-read-the-result)
- [6. Choose the level honestly](#6-choose-the-level-honestly)
- [7. Troubleshooting](#7-troubleshooting)
- [8. Uninstall](#8-uninstall)

---

## 1. What you get

Two surfaces over one engine:

| Surface | What it is | Where it shows up |
| --- | --- | --- |
| `sentience_audit` tool | A model-callable tool that audits a session's own trajectory | In the agent's tool list |
| Audit panel | A read-only view of the same result | Inside the `sentience_audit` tool card |

Both read the same payload, so the panel and the tool output can never
disagree. Nothing calls a model, and nothing leaves your machine.

## 2. Requirements

- **DeepSeek Harness** with a session store — the plugin injects `sessions`.
- **Node ≥ 20**. The package ships compiled JavaScript: nothing builds on your
  machine and no build permission is needed.

Windows, macOS and Linux are all supported. A session audited on one platform
produces the same numbers as the same session audited on another.

## 3. Install

The package is **not on the npm registry yet**, so install the release tarball.
Download `slatinwine-dsh-sentience-audit-0.1.1.tgz` from
<https://github.com/slatinwine/dsh-sentience-audit/releases/latest>, then:

```sh
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.1.tgz
dsh --profile my-profile --dump-config
```

**Confirm the row appears** in the dump:

```yaml
- id: sentience-audit
  name: '@slatinwine/dsh-sentience-audit'
```

If the package installs but no such row appears, see
[Troubleshooting](#7-troubleshooting). Then start the profile:

```sh
dsh --profile my-profile
```

## 4. Run it

Restart the profile, then ask the agent:

> Use the `sentience_audit` tool on this session, then summarize the level and
> which indicators were not satisfied.

The agent calls it with no arguments:

```
sentience_audit()
```

| Parameter | Type | Meaning |
| --- | --- | --- |
| `sessionId` | string, optional | The session to audit. Omit it to audit the session the call runs in. |
| `verbose` | boolean, optional | Reserved for extra detail. |

**Only live sessions can be audited.** Archived sessions are not readable
through the `sessions` service.

## 5. Read the result

```
## 意识指标审计 · L4 · 高阶监控
达成 11 · 无法评估 3 · 缺失 0 · 指标族 5/6 · 置信带 高
```

| Field | Meaning |
| --- | --- |
| 达成 / satisfied | Indicator properties this trajectory demonstrably exhibits |
| 无法评估 / not-assessable | Properties a text trace cannot answer. **Not failures** — see below |
| 缺失 / absent | Properties the trace actively fails to show |
| 指标族 / families | How many of the six theory families reached their threshold |
| 置信带 / band | Coarse confidence, from the satisfied and established counts |

Each indicator carries an **evidence type**, which tells you how much to trust
it:

| Type | Meaning |
| --- | --- |
| 架构既定 / architectural | Supplied by the harness architecture; does not depend on reading behaviour at all |
| 轨迹结构 / structural | Inferred from replayable structure — call lineage, failures, recovery |
| 自我报告 / self-report | Would rest on the system's own statements; the weakest kind |

### Why `not-assessable` is a feature

Three properties require inspecting internal representations: whether perception
is generative (`HOT-1`), whether coding is sparse and smooth (`HOT-4`), and
whether the system truly maintains a model of its own attention (`AST-1`). A
text trace cannot answer them.

They are reported as **无法评估** and excluded from the satisfied count. The
practical consequence: **`AST-1` gates L5, so this tool effectively cannot award
L5.** That is deliberate. A tool that pretended otherwise would be producing
theatre.

## 6. Choose the level honestly

`L1`–`L5` describes **how much of the functional organisation the theories
associate with consciousness this trajectory exhibits**. It is a proxy for
candidacy, never a measurement of experience.

The source report's own conclusion is *no current AI systems are conscious*, and
it warns that behavioural tests are unreliable precisely because a system can
mimic behaviour while working differently. So:

- A coding session with a wide toolset that writes files, reads them back, and
  recovers from failures typically lands at **L2–L3**.
- **A session that works on this very tool scores higher**, because reading back
  its own artifacts and fixing self-detected defects is exactly what `PP-1`,
  `AE-2` and `RPT-2` look for. Do not treat a self-referential session as a
  baseline.
- Levels are **gated, not averaged**: each tier names the specific indicators
  that carry it, so nothing climbs by accumulating unrelated satisfied ones.

## 7. Troubleshooting

### The tool never appears in the agent's list

1. Is the row present in `dsh --profile … --dump-config`? If not, reinstall and
   read the output of the `add` command.
2. Did the agent session start *after* the install? Tool rows are composed at
   session start — start a new session.

### The panel does not render

The panel is the file `exports["./client"]` points at, served to the browser
as-is and mounted only if it registers via `__ModuleLoader__.load`. Check the
installed copy:

```sh
node -e "const p=require('@slatinwine/dsh-sentience-audit/package.json'); console.log(p.exports['./client'].default)"
head -c 200 node_modules/@slatinwine/dsh-sentience-audit/lib/client.js
```

The file must start with `window.__ModuleLoader__.load({`. If it starts with
`import`, the installed package predates 0.1.1 — reinstall.

## 8. Uninstall

```sh
dsh plugin --profile my-profile remove @slatinwine/dsh-sentience-audit
```

That removes both the dependency and the composition layer. To withdraw the
tool while keeping the package installed, disable the row in the profile's
patch file instead:

```yaml
- id: sentience-audit
  disabled: true
```

## What to read next

- [`README.md`](./README.md) — the rubric, the level gates, and the limits
