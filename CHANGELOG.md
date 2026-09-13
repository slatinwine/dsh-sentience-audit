# Changelog

Notable changes, newest first. This project follows [semantic
versioning](https://semver.org/); the rubric revision it scores against is named
in every result, so a rubric change is always a breaking change.

## 0.1.0 — unreleased

First release.

**Rubric.** The 14 indicator properties and the L1–L5 gates follow Butlin, Long,
Elmoznino, Bengio, Birch, Constant, Deane, Fleming, Frith, Ji, Kanai, Klein,
Lindsay, Michel, Mudrik, Peters, Schwitzgebel, Simon & VanRullen (2023),
*Consciousness in Artificial Intelligence: Insights from the Science of
Consciousness*, Table 1 (arXiv:2308.08708). Every result cites it.

**Verdicts are structural.** Signals are read from replayable trace structure —
argument lineage between calls, module-family switching, failure recovery,
artifact write-then-read-back — never from the model's wording. An earlier
revision scored phrases like "assume" or "verify" and inflated every score; the
source report warns that behavioural evidence is unreliable for exactly that
reason.

**Honest ceilings.** `HOT-1`, `HOT-4` and `AST-1` cannot be answered from a text
trace and are reported `not-assessable` rather than guessed, excluded from the
satisfied count. Because `AST-1` gates L5, this tool effectively cannot award L5.

**Levels are gated, not averaged.** Each tier names the specific properties that
carry it, so a session cannot climb by accumulating unrelated satisfied ones.

**Recovery is distinguished from retry.** Two calls are the same attempt when
their arguments are structurally equal after key sorting; unparseable blobs fall
back to shared *content*, never shared vocabulary. `tests/discrimination.mjs`
pins both directions.

**Cross-platform.** Windows, macOS and Linux. Path case is folded only for
Windows-shaped paths, so POSIX sessions are read case-sensitively; shell tool
names (`pwsh`, `powershell`, `bash`, `sh`, `zsh`, `dash`) are one module family;
read-back probes cover both PowerShell and POSIX verbs. The convention is inferred
from the path's own shape rather than `process.platform`, so a score stays a pure
function of the event log and is identical on every host.

**Package shape.** A DSH bundle: `dsh.bundle.patch` contributes one composition
row, `dsh.client` declares the browser panel, and `prepare` builds `lib/` for
both the npm route and Git installs.

**Tests.** Four suites, 97 assertions, no test framework required: engine
invariants, platform parity, built-artifact contract, and argument
discrimination. CI runs them on Ubuntu, macOS and Windows across Node 22 and 24 —
Node 22.18+ is the floor because the suites are TypeScript run directly by Node
through type stripping. The published package is compiled JavaScript and still
runs on Node 20.
