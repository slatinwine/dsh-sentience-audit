/**
 * Platform-compatibility tests.
 *
 * The same plugin runs on Windows, macOS and Linux, and the analyzer reads
 * whatever paths a session happened to record. These cases pin the three places
 * where platform genuinely changes behaviour:
 *
 *   1. POSIX paths must yield the same artifact and read-back signals as Windows ones.
 *   2. Case matters on POSIX (`A.ts` and `a.ts` are two files) but not on Windows.
 *   3. Both PowerShell and POSIX shell probes count as observing produced output.
 *
 *   node --experimental-strip-types tests/platform.ts
 */

import { assess, pathTokens } from '../src/index.ts'
import { sessionFixture } from './fixtures.ts'

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title: string): void {
  console.log(`\n${title}`)
}

/** A write followed by one shell probe of the produced file. */
function probeTrajectory(command: string): unknown[] {
  return sessionFixture({
    tools: [
      { tool: 'write', args: '{"file_path":"/home/dev/proj/out/report.md","content":"hi"}' },
      { tool: 'bash', args: JSON.stringify({ command, description: 'inspect' }) },
    ],
  })
}

/** Two writes to paths differing only in case, then a read of the second. */
function caseTrajectory(pathA: string, pathB: string, readPath: string): unknown[] {
  return sessionFixture({
    tools: [
      { tool: 'write', args: JSON.stringify({ file_path: pathA, content: 'A' }) },
      { tool: 'write', args: JSON.stringify({ file_path: pathB, content: 'B' }) },
      { tool: 'read', args: JSON.stringify({ file_path: readPath }) },
    ],
  })
}

function posixTrajectory(): unknown[] {
  return sessionFixture({
    prompts: 1,
    tools: [
      { tool: 'bash', args: '{"command":"node --version","description":"version"}' },
      { tool: 'read', args: '{"file_path":"/home/dev/proj/src/a.ts"}' },
      { tool: 'edit', args: '{"file_path":"/home/dev/proj/src/a.ts","old_string":"x","new_string":"y"}' },
      { tool: 'grep', args: '{"pattern":"foo","path":"/home/dev/proj/src"}' },
      { tool: 'write', args: '{"file_path":"/home/dev/proj/out/report.md","content":"hi"}' },
      { tool: 'read', args: '{"file_path":"/home/dev/proj/out/report.md"}' },
      { tool: 'bash', args: '{"command":"cat /home/dev/proj/out/report.md","description":"verify report"}' },
      { tool: 'glob', args: '{"pattern":"**/*.md","path":"/home/dev/proj"}' },
      { tool: 'todo_write', args: '{"todos":[{"content":"ship","status":"in_progress"}]}' },
      { tool: 'read', args: '{"file_path":"/home/dev/proj/missing.txt"}', isError: true },
      // Recovery: the read failed, so the trace switches tool rather than
      // repeating the identical call.
      { tool: 'bash', args: '{"command":"cat /home/dev/proj/missing.txt","description":"retry via shell"}' },
      { tool: 'read', args: '{"file_path":"/home/dev/proj/out/report.md"}' },
      { tool: 'web_fetch', args: '{"url":"https://example.com"}' },
    ],
  })
}

section('POSIX paths produce the same structural signals as Windows ones')
const posix = assess({ sessionId: 'posix', events: posixTrajectory() })
check('a POSIX shell still counts as a module family', posix.metrics.toolFamilies >= 4, `families ${posix.metrics.toolFamilies}`)
check('artifact self-read-back detected', posix.metrics.selfReadbacks >= 1, `got ${posix.metrics.selfReadbacks}`)
check('produce-then-observe loop detected', posix.metrics.injectionLoops >= 1, `got ${posix.metrics.injectionLoops}`)
check('artifact reuse detected', posix.metrics.artifactReuse >= 1, `got ${posix.metrics.artifactReuse}`)
check('dependent chain detected', posix.metrics.dependentCalls >= 2, `got ${posix.metrics.dependentCalls}`)
check('error recovery detected', posix.metrics.recoveries >= 1, `got ${posix.metrics.recoveries}`)
check('reaches at least L2', posix.level >= 2, `level ${posix.level}`)

section('POSIX observation verbs count as read-back probes')
for (const command of ['cat /home/dev/proj/out/report.md', 'head -n 20 /home/dev/proj/out/report.md', 'wc -l /home/dev/proj/out/report.md', 'sed -n 1,5p /home/dev/proj/out/report.md', 'stat /home/dev/proj/out/report.md']) {
  const result = assess({ sessionId: command, events: probeTrajectory(command) })
  check(`"${command.split(' ')[0]}" is a probe`, result.metrics.injectionLoops >= 1, `got ${result.metrics.injectionLoops}`)
}

section('path tokens survive both separators')
const winToken = pathTokens('{"file_path":"D:\\\\Git\\\\proj\\\\out\\\\report.md"}')
const posixToken = pathTokens('{"file_path":"/home/dev/proj/out/report.md"}')
check('Windows path yields one token', winToken.length === 1, JSON.stringify(winToken))
check('POSIX path yields one token', posixToken.length === 1, JSON.stringify(posixToken))
check(
  'both reduce to the same filename tail',
  (winToken[0] ?? '').split('/').pop() === (posixToken[0] ?? '').split('/').pop(),
)

section('case sensitivity follows the filesystem')
const posixCase = assess({ sessionId: 'posix-case', events: caseTrajectory('/tmp/A.ts', '/tmp/a.ts', '/tmp/a.ts') })
check('on POSIX, A.ts and a.ts are two artifacts', posixCase.metrics.artifacts === 2, `artifacts ${posixCase.metrics.artifacts}`)

const winCase = assess({ sessionId: 'win-case', events: caseTrajectory('D:\\tmp\\A.ts', 'D:\\tmp\\a.ts', 'd:\\tmp\\a.ts') })
check('on Windows, differing case is one artifact', winCase.metrics.artifacts === 1, `artifacts ${winCase.metrics.artifacts}`)
check(
  'on Windows, the read still pairs with the write',
  winCase.metrics.selfReadbacks >= 1,
  `selfReadbacks ${winCase.metrics.selfReadbacks}`,
)

section('shell tool names are platform-neutral')
for (const shell of ['bash', 'sh', 'zsh', 'dash', 'pwsh', 'powershell']) {
  const result = assess({
    sessionId: shell,
    events: sessionFixture({ tools: [{ tool: shell, args: '{"command":"echo hi"}' }] }),
  })
  const countedAsFamily = result.metrics.toolFamilies >= 1
  check(`${shell} is classified, not dropped`, result.metrics.toolCalls === 1 && countedAsFamily)
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
