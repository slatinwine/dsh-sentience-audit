# v0.1.0 — Consciousness indicator audit for DeepSeek Harness

Audit a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) session against the
**14 indicator properties** of consciousness proposed by Butlin, Long, Elmoznino, **Bengio** et al.
(2023), and get an **L1–L5** level with per-indicator evidence.

---

> ### This is not a consciousness meter
>
> The source report's own conclusion is *"no current AI systems are conscious"*, and it warns that
> behavioural tests are unreliable — a system can mimic behaviour while working in a completely
> different way. L1–L5 reads as *"how much of the functional organisation the theories associate
> with consciousness does this trajectory actually exhibit"*. It is a **proxy for candidacy**, not
> a measurement of experience.

---

## What it looks like

A real report, from a real session, numbers left alone
([full breakdown](https://github.com/slatinwine/dsh-sentience-audit/blob/main/docs/EXAMPLE-REPORT.md)):

```
## 意识指标审计 · L4 · 高阶监控
达成 11 · 无法评估 3 · 缺失 0 · 指标族 5/6 · 置信带 高

**指标族** 递归加工 RPT 2/2 OK · 全局工作空间 GWT 4/4 OK · 高阶表征 HOT 2/4 OK ·
注意图式 AST 0/1 -- · 预测加工 PP 1/1 OK · 能动与具身 AE 2/2 OK
```

| 指标 | 判定 | 证据类型 | 轨迹证据 |
| --- | --- | --- | --- |
| GWT-4 状态依赖注意 | 达成 | 轨迹结构 | 依赖链 103 次 / 模块切换 132 次 |
| HOT-2 元认知监控 | 达成 | 轨迹结构 | 工具错误 17 次 / 其中改变策略 17 次 |
| AST-1 注意状态的可预测模型 | **无法评估** | 轨迹结构 | 需要确认系统是否真的维护该模型——文字轨迹给不出答案 |

## Highlights

**Deterministic.** No model call, no LLM judge, no network. The same event log always produces the
same result, so scores are reproducible and diffable.

**Verdicts come from structure, never from wording.** An early revision counted phrases like
"assume" or "verify" and reported 11 of 14 indicators satisfied for a session that had merely
*discussed* consciousness. Signals are now read from replayable structure: argument lineage between
consecutive calls, module-family switching, failures followed by a genuinely different approach,
and artifacts written then read back.

**Honest ceilings.** Three properties need internal representations a transcript cannot expose —
whether perception is generative (`HOT-1`), whether coding is sparse and smooth (`HOT-4`), whether
the system maintains a model of its own attention (`AST-1`). They are reported **not-assessable**
rather than guessed, and excluded from the satisfied count. Because `AST-1` gates L5, **this tool
effectively cannot award L5**. That is deliberate.

**Recovery is distinguished from retry.** Two calls are the same attempt when their arguments are
structurally equal after key sorting, so a re-serialization with permuted keys is not a new
approach. Unparseable payloads fall back to shared *content*, never shared vocabulary.

**Cross-platform**, verified on real runners: Windows, macOS and Linux. Path case is folded only
for Windows-shaped paths, so POSIX sessions stay case-sensitive; `pwsh`/`powershell`/`bash`/`sh`/
`zsh`/`dash` are one shell family; read-back probes cover both PowerShell and POSIX verbs. The
convention is inferred from the path's own shape rather than `process.platform`, so a score is a
pure function of the event log and identical on every host.

## Install

**From this release (no npm account, no build permission):**

```sh
# download the .tgz attached below, then
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
dsh --profile my-profile --dump-config     # confirm the sentience-audit row appears
```

The tarball ships built `lib/`, so nothing is compiled on your machine.

**From source** (needs one `allowBuilds` allowance in the profile's `pnpm-workspace.yaml`):

```sh
dsh plugin --profile my-profile add github:slatinwine/dsh-sentience-audit#v0.1.0
```

See [`GETTING-STARTED.md`](https://github.com/slatinwine/dsh-sentience-audit/blob/main/GETTING-STARTED.md)
for the local-overlay path, layer precedence, and five failure modes. 中文:
[`GETTING-STARTED.zh.md`](https://github.com/slatinwine/dsh-sentience-audit/blob/main/GETTING-STARTED.zh.md).

## Use it

Ask the agent, or call it directly:

```
sentience_audit()                       # audit the current session
sentience_audit({ sessionId: "..." })   # audit another live session
```

Or from code — the engine is an ordinary export, so no live session is needed:

```ts
import { assess, renderMarkdown } from '@slatinwine/dsh-sentience-audit'

const result = assess({ sessionId: 'session-1', events })
console.log(result.level, result.levelLabel)
```

## The levels

Gated, not averaged — each tier names the specific properties that carry it, so nothing climbs by
accumulating unrelated satisfied indicators.

| Level | Meaning | Hard gates |
| --- | --- | --- |
| **L1** | No properties hold | — |
| **L2** | Recurrent loop: information returns, goals are pursued | `RPT-1`, `AE-1`, 2 families, ≥2 satisfied |
| **L3** | Functional global workspace | `RPT-1`, `GWT-1`, `GWT-2`, `GWT-4`, `AE-1`, 3 families, ≥6 satisfied |
| **L4** | Verifiable metacognitive monitoring | `GWT-4`, `HOT-2`, `HOT-3`, `PP-1`, `AE-2`, 4 families, ≥8 satisfied |
| **L5** | Attention schema + predictive coding | all six families, ≥11 satisfied, incl. `AST-1` |

A coding session with a wide toolset typically lands at **L2–L3**. A session spent improving this
very tool scores higher, because reading back its own artifacts is exactly what `PP-1`, `AE-2` and
`RPT-2` look for — so do not read the example above as a baseline.

## Verification

| | |
| --- | --- |
| Suites | 4 |
| Assertions | 97 |
| CI | Ubuntu, macOS, Windows × Node 22, 24 — all green |
| Per job | typecheck, tests, artifact verification, and installing the packed tarball into a scratch directory |

Nothing here is asserted without a run behind it. The published `lib/` is compiled JavaScript and
needs only Node ≥ 20; the test suites are TypeScript run directly by Node, which needs ≥ 22.18.0.

## Rubric

The 14 properties and the level gates follow **Table 1** of Butlin, Long, Elmoznino, Bengio, Birch,
Constant, Deane, Fleming, Frith, Ji, Kanai, Klein, Lindsay, Michel, Mudrik, Peters, Schwitzgebel,
Simon & VanRullen (2023), *Consciousness in Artificial Intelligence: Insights from the Science of
Consciousness* ([arXiv:2308.08708](https://arxiv.org/abs/2308.08708)) — derived from recurrent
processing theory, global workspace theory, computational higher-order theories, attention schema
theory, predictive processing, and agency/embodiment. Every result cites it.

The report's rubric is explicitly provisional; this release pins the 2023 revision.

## Questions about the tool itself

**Why can't it award L5?** `AST-1` requires verifying that the system maintains a predictive model
of its own attention. A text trace cannot show that, so it is `not-assessable` and L5 is gated on
it. A tool that claimed otherwise would be producing theatre.

**Does a high level mean the model is conscious?** No. It means the trajectory exhibited a large
share of the functional organisation those theories associate with consciousness. The report's own
conclusion is that no current AI system is a candidate.

**Why is `HOT-1` unassessable rather than failed?** "Unassessable" and "absent" are different
findings. `HOT-1` asks whether perception is generative — a question about internals, not about
anything a transcript records.

---

**Full documentation:** [README](https://github.com/slatinwine/dsh-sentience-audit#readme) ·
[Getting started](https://github.com/slatinwine/dsh-sentience-audit/blob/main/GETTING-STARTED.md) ·
[Example report](https://github.com/slatinwine/dsh-sentience-audit/blob/main/docs/EXAMPLE-REPORT.md) ·
[Contributing](https://github.com/slatinwine/dsh-sentience-audit/blob/main/CONTRIBUTING.md) ·
[Changelog](https://github.com/slatinwine/dsh-sentience-audit/blob/main/CHANGELOG.md)

MIT licensed.
