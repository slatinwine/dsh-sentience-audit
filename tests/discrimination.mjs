/**
 * Tests for the recovery-discrimination rule.
 *
 * This rule decides whether a retry after a failed tool call counts as
 * metacognitive monitoring, which is a hard gate for L4. Its earlier revision
 * accepted any string difference, so a cosmetic re-serialization counted as
 * recovery; these cases pin the behaviour that replaced it.
 *
 *   node tests/discrimination.mjs   (requires `npm run build` first)
 */

import {
  argumentSimilarity,
  approachChanged,
  canonicalArgs,
  sharedPrefixSuffixRatio,
} from '../lib/index.js'

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

// The same payload with its object keys permuted, as the trace recorded it.
const permutedA = '{"files":[{"path":"D:\\\\Git\\\\a\\\\README.md","description":"英文 README"},{"path":"D:\\\\Git\\\\a\\\\package.json","description":"包元数据"}]}'
const permutedB = '{"files":[{"description":"英文 README","path":"D:\\\\Git\\\\a\\\\README.md"},{"description":"包元数据","path":"D:\\\\Git\\\\a\\\\package.json"}]}'

section('canonical form ignores key order')
check('permuted keys canonicalize equal', canonicalArgs(permutedA) === canonicalArgs(permutedB))

section('a re-serialization is not a new approach')
check('key-permuted retry is NOT a change', approachChanged(permutedA, permutedB) === false)
check('identical blobs are NOT a change', approachChanged(permutedA, permutedA) === false)

section('a real change is a change')
check(
  'different payload with the same keys IS a change',
  approachChanged('{"content":"file A body"}', '{"content":"file B body"}') === true,
)
check(
  'different target file IS a change, despite shared vocabulary',
  approachChanged(
    '{"file_path":"D:\\\\Git\\\\a\\\\src\\\\core\\\\rubric.ts","content":"export const A = 1"}',
    '{"file_path":"D:\\\\Git\\\\a\\\\src\\\\core\\\\analysis.ts","content":"export const A = 1"}',
  ) === true,
)
check(
  'a mode flip IS a change',
  approachChanged('{"mode":"update","packageId":"pkg-3"}', '{"mode":"run","packageId":"pkg-3"}') === true,
)

section('unparseable payloads fall back to content, not vocabulary')
const truncated = '{"plugin":{"kind":"existing","pluginId":"sentio-1"},"name":"v6 （删除文本启发式'
const truncatedDifferent = '{"plugin":{"kind":"new","idPrefix":"sentio"},"name":"v1 初始版本","code":{'
check('a truncated blob has no canonical form', canonicalArgs(truncated) === undefined)
check('a different truncated blob IS a change', approachChanged(truncated, truncatedDifferent) === true)
check('the same truncated blob is NOT a change', approachChanged(truncated, truncated) === false)
check(
  'a same-size rewrite is caught even when vocabulary overlaps',
  approachChanged(
    '{"content":"aaaa bbbb cccc dddd eeee ffff gggg"}',
    '{"content":"aaaa bbbb cccc dddd eeee ffff hhhh"}',
  ) === true,
)

section('degenerate arguments')
check('two empty argument blobs are NOT a change', approachChanged('', '') === false)
check('empty to non-empty IS a change', approachChanged('', '{"a":1}') === true)
check('non-string input is NOT a change', approachChanged(undefined, undefined) === false)
// Non-strings are outside the declared contract; malformed log data reaches
// here anyway, so the requirement is that it degrades quietly, never throws.
let threw = false
try {
  approachChanged({ a: 1 }, { b: 2 })
  argumentSimilarity(null, 42)
  canonicalArgs(undefined)
} catch {
  threw = true
}
check('malformed input never throws', threw === false)
check('similarity of identical strings is 1', argumentSimilarity('x', 'x') === 1)
check('shared prefix/suffix of unrelated blobs is low', sharedPrefixSuffixRatio('abcdef', 'uvwxyz') < 0.2)

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
