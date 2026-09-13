/**
 * Rewrite `.ts` / `.tsx` specifiers to `.js` inside emitted declaration files.
 *
 * Why this exists: sources use explicit `.ts` extensions so Node can run them
 * directly through its built-in type stripping, and `rewriteRelativeImportExtensions`
 * makes `tsc` rewrite those specifiers in the **JavaScript** output. That option
 * does not touch declaration files, so `lib/types/**\/*.d.ts` would otherwise
 * ship `from './core/types.ts'` — which a consumer's TypeScript cannot resolve
 * (it is masked only while `skipLibCheck` is on).
 *
 * The published declarations must point at the emitted `.js`, matching the
 * runtime, so this closes the gap deterministically after `tsc` runs.
 *
 *   node scripts/fix-declarations.mjs
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const declarationRoot = fileURLToPath(new URL('../lib/types', import.meta.url))

/** Every `.d.ts` under `dir`, recursively. */
function declarationFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...declarationFiles(full))
      continue
    }
    if (entry.endsWith('.d.ts')) out.push(full)
  }
  return out
}

let scanned = 0
let changed = 0

for (const file of declarationFiles(declarationRoot)) {
  scanned += 1
  const before = readFileSync(file, 'utf8')
  // Only relative specifiers carry extensions the emitter left behind.
  const after = before.replace(
    /(from\s+')(\.\.?\/[^']*?)\.tsx?'/g,
    "$1$2.js'",
  )
  if (after !== before) {
    writeFileSync(file, after, 'utf8')
    changed += 1
  }
}

console.log(`declarations: scanned ${scanned}, rewrote ${changed}`)
