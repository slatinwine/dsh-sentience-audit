# Getting started

A first run, from nothing to a real audit result. If you only read one section,
read [Run it](#4-run-it) and [Read the result](#5-read-the-result).

- [1. What you get](#1-what-you-get)
- [2. Requirements](#2-requirements)
- [3. Install](#3-install)
- [4. Run it](#4-run-it)
- [5. Read the result](#5-read-the-result)
- [6. Choose the level honestly](#6-choose-the-level-honestly)
- [7. Without the tool](#7-without-the-tool-auditing-from-code)
- [8. Troubleshooting](#8-troubleshooting)
- [9. Uninstall](#9-uninstall)
- [10. Publishing (author side)](#10-publishing-author-side)

---

## 1. What you get

Two surfaces over one engine:

| Surface | What it is | Where it shows up |
| --- | --- | --- |
| `sentience_audit` tool | A model-callable tool that audits a session's own trajectory | In the agent's tool list |
| Audit panel | A read-only view of the same result | Inside the latest `cordis_run` card |

Both call the same deterministic code, so the panel and the tool can never
disagree. Nothing calls a model, and nothing leaves your machine.

## 2. Requirements

- **DeepSeek Harness** with a session store — the plugin injects `sessions` and
  registers into `tools`. It reads `agents` optionally for caller resolution.
- **Node ≥ 20** for the package itself. The bundled TypeScript is compiled to
  ES2022 with `.js` specifiers; no build step is needed on your side.
- A **pnpm-backed profile** for the bundle install path (`dsh plugin … add`).
  If your profile has no package manager wired up, use the overlay path in
  [Troubleshooting](#a-install-without-a-package-manager) instead.

### Platforms

Windows, macOS and Linux are all supported, and nothing in the package is
platform-specific: no native modules, no shell scripts, no install-time build.
The published `lib/` is compiled JavaScript, so **Node ≥ 20** is enough to use it.

Running the test suites is a separate matter: they are TypeScript executed
directly by Node through type stripping, which needs **Node ≥ 22.18.0**. That is a
development-toolchain floor, not a runtime one.

The analyzer reads paths from the trace, so a session audited on macOS produces
the same numbers as the same session audited on Windows. See
[Platforms](./README.md#platforms) for the three places where platform genuinely
matters and how each is handled.

## 3. Install

### Recommended: install the release tarball

The package is **not on the npm registry yet**, so start from the asset attached
to the release — download `slatinwine-dsh-sentience-audit-0.1.0.tgz` from
<https://github.com/slatinwine/dsh-sentience-audit/releases/latest>.

It already contains the built `lib/`, so **nothing builds on your machine and no
build permission is needed**. It also declares `dsh.bundle.patch`, which is what
makes the install contribute a composition layer containing one row:

```sh
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
dsh --profile my-profile --dump-config
```

**Confirm the row appears** in the dump:

```yaml
- id: sentience-audit
  name: '@slatinwine/dsh-sentience-audit'
```

If the package installs but no such row appears, the `dsh.bundle` declaration did
not resolve — see [Troubleshooting](#b-installed-but-no-row-appears).

Then start the profile:

```sh
dsh --profile my-profile
```

### Alternative: build the same tarball yourself

From a checkout of this repository, `npm pack` produces a byte-equivalent
artifact:

```sh
npm pack                                   # in the package checkout
dsh plugin --profile my-profile add ./slatinwine-dsh-sentience-audit-0.1.0.tgz
```

### Alternative: install from npm (once published)

```sh
dsh plugin --profile my-profile add @slatinwine/dsh-sentience-audit
```

### Alternative: install from Git

Only if you want to track the source. A Git install fetches **sources, not built
artifacts**, so pnpm must run this package's `prepare` script — and pnpm ≥ 10
refuses to do that until you allowlist it. The first `add` fails and names the key
to copy into the profile's `pnpm-workspace.yaml`:

```yaml
allowBuilds:
  '@slatinwine/dsh-sentience-audit': true
```

Re-run the `add`. **That allowance is permission to execute this package's code on
your machine at install time**, outside any sandbox the agent runs under. Pin the
tag (`github:slatinwine/dsh-sentience-audit#v0.1.0`) so a later push cannot change
what runs. Prefer the tarball unless you specifically need the source.

### Local development: load it with an overlay

To run the plugin from a checkout without installing it, point an overlay at the
built entry point. Write `sentience-audit.patch.yml`:

```yaml
- insert:
    - id: sentience-audit
      name: '<specifier for the checked-out package>'
```

The specifier must be something the loader can resolve. On a local checkout that
is an absolute path — and **on Windows an absolute path must be a `file://` URL**,
or Node's ESM loader reads the drive letter as a URL protocol and fails with
`ERR_UNSUPPORTED_ESM_URL_SCHEME`. Generate it rather than writing it by hand:

```powershell
node -e "const{pathToFileURL}=require('node:url');console.log(pathToFileURL(process.argv[1]).href)" "$PWD\lib\index.js"
```

Paste the printed value into `name:`, then boot with the overlay:

```sh
dsh --profile my-profile --patch ./sentience-audit.patch.yml
```

> The overlay form is the standard DSH `--patch` mechanism. I have not executed
> this exact command against a running deployment, so treat it as the documented
> path rather than a verified one; the bundle install in the previous section is
> the path this package is built and packed for.

### Layer order (why your edits sometimes do not win)

Effective order, later layers overriding earlier ones **per row**:

1. profile bundles, in manifest order;
2. the profile's own `cordis.patch.yml`;
3. `$DSH_HOME/cordis.patch.yml`;
4. `--patch` overlays, in command-line order.

A patch replaces the targeted row's entire `config`, so restate every key you
care about rather than expecting a deep merge.

## 4. Run it

Restart the profile, then ask the agent:

> Use the `sentience_audit` tool on this session, then summarize the level and
> which indicators were not satisfied.

The agent calls it with no arguments:

```
sentience_audit()
```

### Parameters

| Parameter | Type | Meaning |
| --- | --- | --- |
| `sessionId` | string, optional | The session to audit. Omit it to audit the session the call runs in. |
| `verbose` | boolean, optional | Reserved for extra detail. |

Resolution order for "which session": an explicit `sessionId`, then the
executing agent's session, then the agent service's current initiator. If none
resolves, the tool returns a readable error instead of guessing.

**Only live sessions can be audited.** Archived sessions are not readable
through the `sessions` service. To audit a finished session you must decode its
log yourself and call `assess` — see [section 7](#7-without-the-tool-auditing-from-code).

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

Each indicator carries an **evidence type**, which tells you how much to trust it:

| Type | Meaning |
| --- | --- |
| 架构既定 / architectural | Supplied by the harness architecture; does not depend on reading behaviour at all |
| 轨迹结构 / structural | Inferred from replayable structure — call lineage, failures, recovery |
| 自我报告 / self-report | Would rest on the system's own statements; the weakest kind |

### Why `not-assessable` is a feature

Three properties require inspecting internal representations: whether perception
is generative (`HOT-1`), whether coding is sparse and smooth (`HOT-4`), and
whether the system truly maintains a model of its own attention (`AST-1`). A text
trace cannot answer them.

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

## 7. Without the tool: auditing from code

The engine is an ordinary export, so you can audit an event list you already
have — no live session, no tool call:

```ts
import { assess, renderMarkdown } from '@slatinwine/dsh-sentience-audit'

const result = assess({ sessionId: 'session-1', events })
console.log(result.level, result.levelLabel)
console.log(renderMarkdown(result))

for (const indicator of result.indicators) {
  console.log(indicator.id, indicator.status, indicator.evidence || indicator.note)
}
```

Also exported: `auditSession`, `auditEvents`, `RUBRIC`, `LEVELS`,
`REQUIREMENTS`, `FAMILIES`, `DISCLAIMER`, and the result types.

The reader accepts the shapes `Session.ownEvents()` yields. It is deliberately
tolerant about nesting and skips events it does not recognize rather than
failing, so a log from a nearby DSH revision usually still works — but a shape it
does not recognize contributes **no** structural signals, which can only lower a
score. If a result looks unexpectedly low, check that tool calls and results were
actually parsed before doubting the session.

## 8. Troubleshooting

### a. Install without a package manager

If `dsh plugin --profile … add` is unavailable, add the row to the profile's own
patch file — `$DSH_HOME/profiles/<profile>/cordis.patch.yml`:

```yaml
- insert:
    - id: sentience-audit
      name: '@slatinwine/dsh-sentience-audit'
```

The package must be resolvable from the profile. This is the manual equivalent
of what `dsh plugin add` maintains.

### b. Installed but no row appears

The manifest's `dsh.bundle.patch` did not resolve. Check the installed copy:

```sh
node -e "const p=require('@slatinwine/dsh-sentience-audit/package.json'); console.log(p.dsh, p.files)"
```

`dsh.bundle.patch` must be `./cordis.patch.yml` and that file must be listed in
`files` so it survives packing.

### c. The tool never appears in the agent's list

1. Is the row present in `dsh --profile … --dump-config`?
2. Did the agent session start *after* the install? Tool rows are composed at
   session start.
3. Does the deployment expose a `sessions` service? The plugin injects it; a
   deployment without one leaves the row waiting rather than erroring.

### d. Rows that never activate

A row waiting on a service is silent by design. Run `--dump-config` and look for
rows that never activated; the missing service is named in the agent-facing
runtime diagnostics.

### e. The panel does not render

The client half is discovered only if the package is visible to the client
scanner and its `./client` build exists. Check both:

```sh
node -e "const p=require('@slatinwine/dsh-sentience-audit/package.json'); console.log(p.dsh?.client, p.exports['./client'])"
ls node_modules/@slatinwine/dsh-sentience-audit/lib/client/
```

If announcements mention `client bundle not found`, the published package is
missing `lib/client/` — `npm run build` writes it, and `prepack` runs that build.

## 9. Uninstall

```sh
dsh plugin --profile my-profile remove @slatinwine/dsh-sentience-audit
```

That removes both the dependency and the composition layer. To withdraw the tool
while keeping the package installed, disable the row in the profile's patch file
instead:

```yaml
- id: sentience-audit
  disabled: true
```

## 10. Publishing (author side)

Official reference: [Package and install a plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)
([中文](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)).
The summary below is how this package follows it.

### What a published bundle must declare

| Requirement | Why |
| --- | --- |
| `dsh.bundle.patch` → `./cordis.patch.yml` | Without it, `dsh plugin add` installs a plain dependency, prints a warning, and activates **no layer** |
| The patch file listed in `files` | Otherwise packing drops it and the installed package contributes nothing |
| Built `lib/` listed in `files` | Consumers of the npm route must receive runnable artifacts |
| A `prepare` script | `npm publish`/`npm pack` **and** Git installs run it; a `prepack`-only script leaves Git installs without `lib/` |
| `publishConfig.access: "public"` | A scoped package defaults to restricted publishing |

### The sequence

```sh
# 1. Set the real name in package.json AND cordis.patch.yml — both must match.
#    Also set repository.url; it is what the npm page and provenance show.
# 2. Verify the artifact before publishing.
npm test
npm pack --dry-run      # confirm lib/, lib/client/, cordis.patch.yml are listed
# 3. Publish. `prepare` builds lib/ first, so a stale or missing build cannot ship.
npm publish
```

The name appears in **two** places — `package.json` and the row inside
`cordis.patch.yml`. Changing one without the other produces an install that
resolves no layer, which is exactly the silent failure the `--dump-config` check
in [section 3](#3-install) catches.

### Why both routes are kept

`prepare` is what makes the Git route work at all, and it costs the npm route
nothing: `prepare` also runs before `npm pack` and `npm publish`. The trade is
one extra build on the publishing machine only. npm remains the recommended route
because it spares users the `allowBuilds` permission; the Git route stays
available for anyone who wants to read or patch the source.

## What to read next

- [`README.md`](./README.md) — the rubric, every structural signal, and the limits
- [`src/core/rubric.ts`](./src/core/rubric.ts) — the 14 properties and the level gates, in code
