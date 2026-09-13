# Contributing

Thanks for looking. This document is short on ceremony and long on the two
things that actually matter here: **the rubric must stay honest**, and **claims
must be verifiable from the repository**.

## The one rule that matters

This package scores sessions against a published rubric. Its value is entirely in
being trustworthy, so a change that raises scores without adding real evidence is
a regression, even if every test still passes.

Concretely: **never score from the model's wording.** An early revision counted
phrases like "assume", "verify" or "trade-off" and reported 11 of 14 indicators as
satisfied for a session that had merely *discussed* consciousness. The source
report warns about exactly this — a system can mimic behaviour while working in a
completely different way. Verdicts come from replayable structure:

- argument lineage between consecutive calls,
- module-family switching,
- failures followed by a genuinely different approach,
- artifacts written and then read back.

If you want to add a signal, say in the pull request **what structure it observes
and what could produce it without the underlying property**. Both are required.

## Ground rules for a rubric change

The 14 properties and the L1–L5 gates come from Butlin, Long, Elmoznino, Bengio
et al. (2023), Table 1. So:

- Keep `RUBRIC` at exactly those 14 properties. If the source list changes, that
  is a discussion first, not a patch.
- A property that needs internal representations must be reported
  `not-assessable`, never inferred from text. That is why `AST-1`, `HOT-1` and
  `HOT-4` are unassessable, and why this tool effectively cannot award L5.
- Level gates are hard clauses, not a sum. Do not let a tier be reached by
  accumulating unrelated satisfied properties.

## Getting set up

```sh
npm install          # `prepare` builds lib/
npm run typecheck    # host, client, and test configs
npm test             # docs + engine + contract + discrimination suites
npm run verify:pack  # checks the package is publishable and installable
```

`npm test` starts with `scripts/check-docs.mjs`, because the documentation is part
of the deliverable here: it verifies that in-page anchors resolve, that links
point at files that exist, that code fences are balanced, that no document
carries encoding damage, and that each English/Chinese pair still has the same
number of sections. A translation that quietly lost a section is the kind of
regression nothing else in this repository would catch.

Node ≥ 22.18.0 to run the suites, and Node ≥ 20 to *use* the package. Nothing
else is required — no pnpm, no shell scripts, no native modules.

That version split is deliberate and worth understanding before you hit it. The
published `lib/` is compiled JavaScript and runs on Node 20 or later. The test
suites are TypeScript executed directly by Node through **type stripping**, which
needs **v22.18.0 or later** — below that Node requires `--experimental-strip-types`,
and v20 has no type stripping at all.

The suites need no test framework, which is what makes them runnable in
constrained environments where installing one is not possible.
`npm run test:vitest` runs the same engine cases under Vitest if you prefer a
reporter.

## What CI checks

`.github/workflows/ci.yml` runs the suites on **Ubuntu, macOS and Windows** across
Node 22 and 24. That matrix is not decoration: path case handling, shell tool
names and read-back probe verbs all differ per platform, and `tests/platform.ts`
exists to pin them. A change that only passes on Linux is not done.

CI also runs `verify:pack` and installs the packed tarball into a scratch
directory, because a bundle that packs without its patch file or without built
output installs and then contributes nothing.

## Adding a test

Put engine-level behavioural cases in `tests/run.ts`, platform-dependent ones in
`tests/platform.ts`, built-artifact contract checks in `tests/contract.mjs`, and
argument-discrimination cases in `tests/discrimination.mjs`.

When a test fails, decide which is wrong before fixing either. A recent example:
`tests/platform.ts` asserted that a POSIX trajectory recovered from a failure,
but the fixture retried with byte-identical arguments — the rule correctly called
that a retry, and **the fixture was wrong**.

Write fixtures as `sessionFixture({ tools: [...] })` from `tests/fixtures.ts`.
Assertions should state a property, not a snapshot. Prefer "a prose-only
trajectory satisfies nothing" over an expected score.

When a test would only pass by exercising input outside the declared contract,
assert the property that actually matters (for example *malformed input never
throws*) rather than pinning incidental behaviour.

## Style

- TypeScript, ES2022, `strict`. Keep `noUncheckedIndexedAccess` happy.
- Relative imports use explicit `.ts` extensions; `tsc` rewrites them on emit and
  `scripts/fix-declarations.mjs` does the same for `.d.ts` files. Both steps are
  load-bearing — see the note in `README.md`.
- Comments explain **why**, especially where a decision is a tradeoff. The
  existing code is the reference for tone; match it.

## Documentation

English and Chinese versions move together: `README.md` / `README.zh.md`,
`GETTING-STARTED.md` / `GETTING-STARTED.zh.md`. If you change one, change its pair
in the same pull request. Keep documentation honest — if something is untested or
unverified, say so rather than implying coverage that does not exist.

## Releasing

1. Update `CHANGELOG.md`.
2. Bump `version` in `package.json`.
3. `npm test && npm run verify:pack`.
4. `npm publish` — `prepare` rebuilds `lib/`, so a stale build cannot ship.

The package name appears in **two** places: `package.json` and the row inside
`cordis.patch.yml`. `verify:pack` fails if they disagree, because a mismatch
produces an install that resolves no composition layer.

Publishing to a registry is optional for a DSH bundle, and this package has not
been published: every install route in the README works without an npm account.
If you do publish, note that a published version is never reusable — a mistake is
fixed by publishing the next version, not by withdrawing the last one.

## License

Contributions are accepted under the MIT license in `LICENSE`.
