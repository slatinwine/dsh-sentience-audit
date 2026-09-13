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
**How verdicts are reached:** [below](#why-the-verdicts-are-structural) · **Contributing:** [`CONTRIBUTING.md`](./CONTRIBUTING.md)

- **Rubric:** [Consciousness in Artificial Intelligence: Insights from the Science of Consciousness](https://arxiv.org/abs/2308.08708)
  (arXiv:2308.08708), Table 1 — 14 indicator properties derived from recurrent processing theory,
  global workspace theory, computational higher-order theories, attention schema theory, predictive
  processing, and agency/embodiment.
- **Method:** deterministic. No model call, no LLM judge, no network. The same event log always
  produces the same result, so scores are reproducible and diffable.
- **Honest ceiling:** three properties cannot be answered from a transcript and are reported
  `not-assessable` rather than guessed. `AST-1` gates L5, so this tool effectively cannot award L5.

## Platforms

Windows, macOS and Linux are all supported. Three places in the analyzer are
platform-sensitive, and each is handled from the trace rather than from the host
it happens to run on:

| Concern | How it is handled |
| --- | --- |
| Shell tool names | `pwsh` / `powershell` on Windows and `bash` / `sh` / `zsh` / `dash` on macOS and Linux are all one specialised shell module |
| Read-back probes | Both spellings are recognized: `cat`, `head`, `tail`, `wc`, `stat`, `sed`, `find`, `jq` … and `Get-Content`, `Select-String`, `Test-Path`, `Get-ChildItem` … |
| Path case | Folded only for Windows-shaped paths. On a POSIX filesystem `A.ts` and `a.ts` are two different files, and treating them as one would fuse distinct artifacts |

Case handling deliberately infers the convention **from the path's own shape**
(backslashes or a drive letter mean Windows) instead of reading
`process.platform`. A score is then a pure function of the event log: the same
session audited on macOS and on Windows returns the same number, which is what
makes the result diffable and reproducible. The cost is that a session using
POSIX separators on Windows would be read as case-sensitive — a rare combination
that can only report *fewer* artifacts, never invent them.

`tests/platform.ts` covers all three, including a POSIX trajectory that must
produce the same structural signals as its Windows counterpart.

## Why the verdicts are structural

An early revision scored indicators from the model's **wording** — counting phrases like
"assume", "verify", or "trade-off". That measured vocabulary, not architecture, and it inflated
every score: a transcript that merely *discussed* consciousness scored as if it exhibited it.

This package therefore reads **only replayable trace structure**:

| Signal | What it actually measures |
| --- | --- |
| `dependentCalls` | A later tool call whose arguments carry a path the previous result surfaced — the observable form of "the result was consumed" |
| `moduleSuccessions` | Consecutive calls that switch specialised module family |
| `recoveries` | Tool failures after which the trace **genuinely** changed approach (see below) |
| `artifactReuse` | Paths the session itself wrote, later consumed by a different tool |
| `selfReadbacks` | Reads of a path the session itself wrote |
| `injectionLoops` | Produce-then-observe loops back through an input module |

### Telling recovery from a retry

`recoveries` gates L4, so it cannot be satisfied by any string difference. Two
calls are the **same attempt** when their argument blobs are structurally equal
after key sorting — a pure re-serialization is not a new approach. When a blob
does not parse as JSON (a large payload the session truncated), the comparison
falls back to how much *content* the two blobs share, never to shared vocabulary:
identifiers repeat across a codebase, so a whole-file rewrite can share almost
every token while being an entirely different attempt.

```ts
import { approachChanged } from '@slatinwine/dsh-sentience-audit'

approachChanged('{"a":1,"b":2}', '{"b":2,"a":1}')   // false — same payload
approachChanged('{"content":"A"}', '{"content":"B"}') // true  — real change
```

Both directions are covered by `tests/discrimination.mjs`.

Properties that need **inspection of internal representations** are reported as
**`not-assessable`** rather than guessed, and are excluded from the satisfied count:

- `HOT-1` — is perception generative / top-down?
- `HOT-4` — is coding sparse and smooth, forming a quality space?
- `AST-1` — does the system really maintain a predictive model of its own attention?

`AST-1` being unassessable is why **L5 is effectively unreachable through this tool**, and that is
intentional. A text trace cannot answer those questions, and a tool that pretends otherwise is
producing theatre.

## Install

Two supported routes. **npm is the recommended one** — users install a
prebuilt artifact and need no build permission at all. The Git route exists for
people who want to track the source, and costs one explicit allowance; it is
described at the end of this section.

### npm (recommended)

```sh
dsh plugin --profile my-profile add @slatinwine/dsh-sentience-audit
dsh --profile my-profile --dump-config     # confirm the sentience-audit row is present
```

The published tarball already contains `lib/`, so nothing builds on the user's
machine. The package declares **`dsh.bundle.patch`**, which is what makes
`dsh plugin add` contribute a composition layer rather than merely installing a
dependency — a package without that declaration installs silently and adds no
row, which is the failure worth checking for in `--dump-config`.

A tarball works the same way if you would rather not use a registry:

```sh
npm pack                                   # author side, in the package
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
```

### From Git (source, opt-in)

```sh
dsh plugin --profile my-profile add github:slatinwine/dsh-sentience-audit#<sha>
```

A Git install fetches **sources, not built artifacts**, and pnpm ≥ 10 refuses to
run a dependency's build script until it is allowlisted. The first `add` fails
and names the package key to copy into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '@slatinwine/dsh-sentience-audit': true
```

Re-run the `add` afterwards. **Treat that allowance as permission to execute this
package's code on your machine at install time**, outside any sandbox the agent
runs under — that is what running `prepare` means. Pin a commit (`#<sha>`) so a
later push cannot change what runs. This package's `prepare` is self-contained
(two `tsc` invocations plus a declaration rewrite, with `typescript` in
`devDependencies`); it does not reach outside the package.

### Host and client planes

**Host plane** — the row the bundle supplies. Put the same row in a preset instead if only one
session should gain the tool:

```yaml
- id: sentience-audit
  name: '@slatinwine/dsh-sentience-audit'
```

The plugin declares `inject: ['sessions']` and reads `tools` and `agents` optionally. If the
deployment has no tool registry it contributes nothing and does not fail the mount.

**Client plane** — the browser panel is a separate build of the same package. Its
`package.json` carries the `dsh.client` declaration, so a deployment that scans client packages
discovers and serves `./client` like any first-party UI package; the panel renders inside the latest
`cordis_run` card. The panel asks the host for the audit, so the browser view and the model-facing
tool output can never disagree.

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

Or programmatically:

```ts
import { assess } from '@slatinwine/dsh-sentience-audit'

const result = assess({ sessionId: 'session-1', events })
console.log(result.level, result.levelLabel)   // 3, 'L3 · 全局工作空间'
console.log(result.indicators)                 // one verdict per rubric entry
```

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

## Exports

| Entry | Contents |
| --- | --- |
| `.` | Cordis host plugin (`name`, `inject`, `apply`) plus the audit engine: `assess`, `auditSession`, `auditEvents`, `RUBRIC`, `LEVELS`, `REQUIREMENTS`, `DISCLAIMER`, `renderMarkdown`, and the result types |
| `./client` | The browser panel (built bundle) |

## Development

```sh
npm install
npm run build            # compiles host (tsconfig.json) and client (tsconfig.client.json)
npm run typecheck        # both halves, no emit
npm test                 # engine invariants + runtime contract verification
npm run test:vitest      # the same engine suite under Vitest
```

`npm test` runs two suites:

- **`tests/run.ts`** — engine invariants (29 assertions), including the one that
  matters most: a prose-only trajectory must score L1 with zero satisfied
  indicators.
- **`tests/platform.ts`** — Windows/macOS/Linux parity (24 assertions): a POSIX
  trajectory yields the same signals as its Windows counterpart, POSIX observation
  verbs count as probes, and case follows the filesystem.
- **`tests/contract.mjs`** — runs against the **built** `lib/`, so it exercises
  the real `defineTool` DSL validator and the real module graph: the schema is
  accepted at runtime, the tool audits a fake session end to end, session
  resolution works from an explicit id, from the executing agent, and fails with
  a teaching error when neither is available, and `apply()` registers through a
  tool registry while degrading safely without one.

Sources import each other with explicit `.ts` extensions, which lets
`node --experimental-strip-types` run them directly. `tsc`'s
`rewriteRelativeImportExtensions` rewrites those specifiers to `.js` in the
emitted JavaScript, but **not** in the generated `.d.ts` files — so
`scripts/fix-declarations.mjs` performs the same rewrite on `lib/types/**`. Without
it the published declarations would point at `./core/types.ts`, which a consumer's
TypeScript cannot resolve; that breakage stays hidden as long as `skipLibCheck` is
on, which is exactly why the build does the rewrite instead of relying on it.

Both test suites run without a test framework, which is what makes them usable in a
constrained environment; `test:vitest` is there for a normal shell.

`prepack` builds automatically, so `npm publish` cannot ship a stale or missing
`lib/`.

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
