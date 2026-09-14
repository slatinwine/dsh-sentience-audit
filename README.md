# dsh-sentience-audit

[![CI](https://github.com/slatinwine/dsh-sentience-audit/actions/workflows/ci.yml/badge.svg)](https://github.com/slatinwine/dsh-sentience-audit/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Audit a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) session against the
**14 indicator properties** of consciousness proposed by Butlin, Long, Elmoznino, **Bengio** et al.
(2023), and report an **L1–L5** level with per-indicator evidence.

> **This is not a consciousness meter.** The source report's own conclusion is *"no current AI
> systems are conscious"*, and it warns that behavioural tests are unreliable because a system can
> mimic behaviour while working in a completely different way. L1–L5 reads as *"how much of the
> functional organisation the theories associate with consciousness does this trajectory actually
> exhibit"* — a **proxy for candidacy**, not a measurement of experience.

**Start here:** [`GETTING-STARTED.md`](./GETTING-STARTED.md) · 中文: [`GETTING-STARTED.zh.md`](./GETTING-STARTED.zh.md)
**See a real report:** [`docs/EXAMPLE-REPORT.md`](./docs/EXAMPLE-REPORT.md)
**Contributing:** [`CONTRIBUTING.md`](./CONTRIBUTING.md)

- **Rubric:** [Consciousness in Artificial Intelligence: Insights from the Science of Consciousness](https://arxiv.org/abs/2308.08708)
  (arXiv:2308.08708), Table 1 — 14 indicator properties drawn from recurrent processing theory,
  global workspace theory, computational higher-order theories, attention schema theory, predictive
  processing, and agency/embodiment.
- **Method:** deterministic and platform-independent. No model call, no LLM judge, no network. The
  same event log always produces the same result, on any OS.
- **Honest ceiling:** three properties cannot be answered from a transcript and are reported
  `not-assessable` rather than guessed. `AST-1` gates L5, so this tool effectively cannot award L5.

## Why the verdicts are structural

An earlier revision scored indicators from the model's **wording** — counting phrases like
"assume" or "verify". That measured vocabulary, not architecture, and it inflated every score: a
transcript that merely *discussed* consciousness scored as if it exhibited it.

This package therefore reads **only replayable trace structure** — whether a later call consumed a
path an earlier result surfaced, whether the session wrote files and read them back, whether it
genuinely changed approach after a failure. Scores are reproducible and diffable.

Properties that need **inspection of internal representations** are reported as
**`not-assessable`** rather than guessed, and are excluded from the satisfied count:

- `HOT-1` — is perception generative / top-down?
- `HOT-4` — is coding sparse and smooth, forming a quality space?
- `AST-1` — does the system really maintain a predictive model of its own attention?

`AST-1` being unassessable is why **L5 is effectively unreachable through this tool**, and that is
intentional. A text trace cannot answer those questions, and a tool that pretends otherwise is
producing theatre.

## Install

The package is **not on the npm registry yet**, so install the release tarball (it ships built
`lib/` — nothing compiles on your machine):

```sh
# download slatinwine-dsh-sentience-audit-0.1.1.tgz from
# https://github.com/slatinwine/dsh-sentience-audit/releases/latest, then
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.1.tgz
dsh --profile my-profile --dump-config     # confirm the sentience-audit row is present
```

Full walkthrough — including verifying the install, troubleshooting, and
uninstalling — lives in [`GETTING-STARTED.md`](./GETTING-STARTED.md).

## Use

The model calls the `sentience_audit` tool:

```
sentience_audit()                       # audit the current session
sentience_audit({ sessionId: "..." })   # audit another live session
```

Result (abridged):

```
## 意识指标审计 · L3 · 全局工作空间
达成 8 · 无法评估 3 · 缺失 3 · 指标族 3/6 · 置信带 中
...
| 指标 | 判定 | 证据类型 | 轨迹证据 / 原因 |
| RPT-1 输入模块采用算法递归 | 达成 | 架构既定 | 工具调用 65 次 / 涉及轮次 1 / 步内回流 59 次 |
| HOT-1 生成式 / 自上而下 / 带噪的知觉模块 | 无法评估 | 轨迹结构 | 需要检查输入模块内部… |
```

The same result renders as a structured panel inside the tool card.

## The levels

The level is **gated, not averaged**. Each tier names the specific properties that carry it, so a
session cannot climb by accumulating unrelated satisfied indicators.

| Level | Meaning | Hard gates |
| --- | --- | --- |
| **L1** | No properties hold | — |
| **L2** | Recurrent loop: information returns, goals are pursued | `RPT-1`, `AE-1`, 2 families, ≥2 satisfied |
| **L3** | Functional global workspace | `RPT-1`, `GWT-1`, `GWT-2`, `GWT-4`, `AE-1`, 3 families, ≥6 satisfied |
| **L4** | Verifiable metacognitive monitoring | `GWT-4`, `HOT-2`, `HOT-3`, `PP-1`, `AE-2`, 4 families, ≥8 satisfied |
| **L5** | Attention schema + predictive coding | all six families, ≥11 satisfied, incl. `AST-1` |

A harness with a wide toolset that writes files, reads them back, and recovers from failures
typically lands at **L2–L3**. That is the honest ceiling for an architecture whose attention
schema cannot be verified from its transcript.

## Limitations

- **Trace-based only.** Anything requiring internal representations is `not-assessable` by design.
- **Live sessions only.** The `sessions` service holds live sessions; archived ones are not readable
  through it.
- **Proxies, not the properties themselves.** "Module switching" is an observable proxy for
  successive queries of specialised modules; it is not proof that a global workspace exists.
- **The rubric is provisional.** Its authors state they expect the indicator list to change as
  research continues. This package pins the 2023 Table 1 revision and cites it in every result.

## License

MIT. The rubric and quoted property wording come from the cited report, licensed
[CC BY-NC-SA 4.0](http://creativecommons.org/licenses/by-nc-sa/4.0/); see the report for its terms.
