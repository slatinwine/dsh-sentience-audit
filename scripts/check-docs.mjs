/**
 * Documentation checks.
 *
 * The docs are the product here: a rubric tool is only as good as its ability to
 * be understood and re-verified, and this repository ships eleven documents in
 * two languages. Broken anchors, unbalanced code fences, links to files that do
 * not exist, and a translation that drifted out of sync are all silent — they
 * render fine to whoever wrote them and fail for everyone else.
 *
 *   node scripts/check-docs.mjs
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

/** Every markdown document in the repository. */
function documents(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'lib' || entry === '.npm-cache') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) documents(full, out)
    else if (entry.endsWith('.md')) out.push(full)
  }
  return out
}

/**
 * The document with fenced code blocks replaced by blanks.
 *
 * Headings and links inside a fence are sample text, not structure — this
 * repository quotes audit output in fenced blocks, which contains lines like
 * `## 意识指标审计 · L3`. Counting those as sections produces false drift.
 */
function outsideFences(text) {
  const kept = []
  let fenced = false
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      fenced = !fenced
      kept.push('')
      continue
    }
    kept.push(fenced ? '' : line)
  }
  return kept.join('\n')
}

/**
 * Anchors a heading produces, in raw and percent-encoded form.
 *
 * GitHub lowercases, drops punctuation, and turns spaces into hyphens; CJK
 * characters survive and are percent-encoded in the href.
 */
function anchorsFor(text) {
  const anchors = new Set()
  for (const match of outsideFences(text).matchAll(/^#{2,4}\s+(.+)$/gm)) {
    const base = match[1]
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
    anchors.add(base)
    anchors.add(encodeURIComponent(base).toLowerCase())
  }
  return anchors
}

/** Top-level section headings, ignoring anything inside a fence. */
function sectionCount(text) {
  return (outsideFences(text).match(/^##\s+/gm) ?? []).length
}

const problems = []
const files = documents(root)
let anchorsChecked = 0
let linksChecked = 0

for (const file of files) {
  const label = relative(root, file).split(sep).join('/')
  const text = readFileSync(file, 'utf8')

  if (text.includes('\uFFFD')) problems.push(`${label}: contains a Unicode replacement character (encoding damage)`)

  const anchors = anchorsFor(text)
  for (const href of new Set([...text.matchAll(/\]\(#([^)]+)\)/g)].map((m) => m[1]))) {
    anchorsChecked += 1
    if (!anchors.has(href) && !anchors.has(decodeURIComponent(href))) {
      problems.push(`${label}: in-page link "#${href}" matches no heading`)
    }
  }

  const fences = (text.match(/^```/gm) ?? []).length
  if (fences % 2 !== 0) problems.push(`${label}: ${fences} code fences — unbalanced`)

  const links = new Set([...text.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)].map((m) => m[1]))
  for (const href of links) {
    linksChecked += 1
    const target = join(dirname(file), decodeURIComponent(href.split('#')[0]))
    if (!existsSync(target)) problems.push(`${label}: links to "${href}", which does not exist`)
  }
}

// Paired documents must not drift: a translation that lost a section is the
// failure mode nobody notices until a reader does.
const pairs = [
  ['README.md', 'README.zh.md'],
  ['GETTING-STARTED.md', 'GETTING-STARTED.zh.md'],
  ['docs/RELEASE-NOTES-v0.1.0.md', 'docs/RELEASE-NOTES-v0.1.0.zh.md'],
]
for (const [en, zh] of pairs) {
  if (!existsSync(join(root, en)) || !existsSync(join(root, zh))) {
    problems.push(`paired documents missing: ${en} / ${zh}`)
    continue
  }
  const [a, b] = [sectionCount(readFileSync(join(root, en), 'utf8')), sectionCount(readFileSync(join(root, zh), 'utf8'))]
  if (a !== b) problems.push(`${en} has ${a} sections but ${zh} has ${b}`)
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`  FAIL ${problem}`)
  process.exit(1)
}

console.log(`  ok   ${files.length} documents, ${anchorsChecked} anchors and ${linksChecked} links resolve`)
console.log(`  ok   ${pairs.length} language pairs have matching section counts (code fences excluded)`)
console.log('  ok   no encoding damage, no unbalanced code fences')
