/**
 * Bundle the client half into the artifact the DSH web app serves.
 *
 * The web app does not transform client entries at request time: the file the
 * package's `exports["./client"]` points at is served to the browser as-is and
 * must be a prebuilt, `window.__ModuleLoader__.load({ id, factory })`-wrapped
 * bundle — exactly what every official client package ships as `lib/client.js`
 * (produced by their tsdown build). A plain `tsc` output (`lib/client/index.js`,
 * bare ESM with `export` statements) is served raw, fails to register, and is
 * silently dropped from the combined client bundle.
 *
 * This script therefore bundles the tsc-compiled `lib/client/index.js` with
 * esbuild (react and react/jsx-runtime stay external: the injected
 * `@deepseek-ai/dsh-client-ui-renderer` package provides them at require-time)
 * and wraps the CJS body in the loader registration shape.
 *
 * Run after `tsc -p tsconfig.client.json`; wired into `npm run build`.
 */

import { build } from 'esbuild'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))

const result = await build({
  entryPoints: [resolve(root, 'lib/client/index.js')],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: ['react', 'react/jsx-runtime'],
  write: false,
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'warning',
})

const body = result.outputFiles[0].text.trim()

const banner = [
  'window.__ModuleLoader__.load({',
  `\tid: ${JSON.stringify(pkg.name)},`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
].join('\n')

const footer = [
  '\t\treturn module.exports;',
  '\t}',
  '});',
  '',
].join('\n')

writeFileSync(resolve(root, 'lib/client.js'), `${banner}\n${body}\n${footer}`)
console.log(`bundle-client: wrote lib/client.js (${body.length} bytes body)`)
