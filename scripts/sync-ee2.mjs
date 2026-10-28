// @ts-check
// Syncs game data from an Exiled Exchange 2 clone (default _upstream/ee2) into public/data and
// records the clone's commit in src/lib/ee2/UPSTREAM_COMMIT. The ported code in src/lib/ee2 is
// copied by hand; `--diff` shows how it differs from the clone (our `// [port]` edits, or
// upstream changes still to port after the clone moved on).
//
//   node scripts/sync-ee2.mjs [--from <ee2 clone>]          copy data, write UPSTREAM_COMMIT
//   node scripts/sync-ee2.mjs [--from <ee2 clone>] --diff   only print the diff of src/lib/ee2
//
// Clone EE2 with `git clone -c core.autocrlf=false`: the data must keep LF (reference F-07).

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = path.join(ROOT, 'public/data')
const LIB_DIR = path.join(ROOT, 'src/lib/ee2')
const COMMIT_FILE = path.join(LIB_DIR, 'UPSTREAM_COMMIT')

/** Game languages of the app (`Lang` in src/app/constants.ts). */
const LANGS = ['en', 'ru']
/** Per language: what the ported logic loads (assets/data, client-string-loader) and the UI texts. */
const LANG_FILES = ['items.ndjson', 'stats.ndjson', 'client_strings.js', 'app_i18n.json']
/**
 * Data root: `item-drop.json` is what `init()` loads. Its hand-written source `item-drop.jsonc`
 * and `patrons.json` (EE2's About screen) are not needed at runtime.
 */
const ROOT_FILES = ['item-drop.json']

const args = process.argv.slice(2)
const fromIdx = args.indexOf('--from')
const ee2 = path.resolve(ROOT, fromIdx === -1 ? '_upstream/ee2' : args[fromIdx + 1])
const upstreamData = path.join(ee2, 'renderer/public/data')
const upstreamSrc = path.join(ee2, 'renderer/src')

const commit = execFileSync('git', ['-C', ee2, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim()
const recorded = fs.existsSync(COMMIT_FILE) ? fs.readFileSync(COMMIT_FILE, 'utf-8').trim() : undefined

if (args.includes('--diff')) {
  printDiff()
} else {
  syncData()
}

function syncData () {
  const files = [
    ...ROOT_FILES,
    ...LANGS.flatMap(lang => LANG_FILES.map(file => `${lang}/${file}`))
  ]
  for (const file of files) {
    const text = fs.readFileSync(path.join(upstreamData, file))
    if (text.includes(13)) {
      throw new Error(`${file} has CR line endings: clone EE2 with core.autocrlf=false`)
    }
  }

  // Start clean, so files EE2 dropped do not linger; indexes are rebuilt by make-data-indexes.
  fs.rmSync(DATA_DIR, { recursive: true, force: true })
  for (const file of files) {
    const target = path.join(DATA_DIR, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(upstreamData, file), target)
  }
  fs.writeFileSync(COMMIT_FILE, commit + '\n')

  console.log(`Synced ${files.length} data files from EE2 ${commit}`)
  if (recorded && recorded !== commit) {
    console.log(`Code in src/lib/ee2 was ported from ${recorded}: check upstream changes with --diff`)
  }
}

function printDiff () {
  if (recorded !== commit) {
    console.log(`Note: src/lib/ee2 is recorded at ${recorded}, the clone is at ${commit}\n`)
  }
  const ported = listFiles(LIB_DIR).filter(file => file.endsWith('.ts'))
  let changed = 0
  for (const file of ported) {
    const upstream = path.join(upstreamSrc, file)
    const ours = path.join(LIB_DIR, file)
    if (!fs.existsSync(upstream)) {
      console.log(`Not in upstream: ${file}`)
      changed += 1
      continue
    }
    const rel = (/** @type {string} */ file) => path.relative(ROOT, file).replaceAll('\\', '/')
    const result = spawnSync('git', ['diff', '--no-index', '--no-color', rel(upstream), rel(ours)], { cwd: ROOT, encoding: 'utf-8' })
    if (result.status !== 0) {
      changed += 1
      process.stdout.write(result.stdout)
    }
  }
  console.log(`\n${ported.length} ported files, ${changed} differ from upstream`)
}

/** @param {string} dir @returns {string[]} paths relative to `dir`, with `/` */
function listFiles (dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
}
