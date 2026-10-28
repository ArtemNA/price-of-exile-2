// @ts-check
// Builds *.index.bin lookup tables for public/data/<lang>/{items,stats}.ndjson.
// Port of APT renderer/src/assets/make-index-files.mjs (MIT © 2020 Alexander Drozdov);
// languages are detected from the data folders instead of a hardcoded list.

import fnv1a from '@sindresorhus/fnv1a'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/data')

/** @param {string} text */
const hash = (text) => Number(fnv1a(text, { size: 32 }))

/** @param {Array<{ hash: number, start: number }>} entries */
function writeIndex (entries, file) {
  entries.sort((a, b) => a.hash - b.hash)
  const data = new Uint32Array(entries.length * 2)
  for (let i = 0; i < entries.length; i += 1) {
    data[i * 2 + 0] = entries[i].hash
    data[i * 2 + 1] = entries[i].start
  }
  fs.writeFileSync(file, data)
}

/** Offsets are JS string (UTF-16) indices: the app slices the same string, not bytes. */
function * ndjsonLines (file) {
  const ndjson = fs.readFileSync(file, { encoding: 'utf-8' })
  let start = 0
  while (start !== ndjson.length) {
    const end = ndjson.indexOf('\n', start)
    yield { start, record: JSON.parse(ndjson.slice(start, end)) }
    start = end + 1
  }
}

function makeStatsIndexes (langDir) {
  const byRef = []
  const matchers = []
  for (const { start, record } of ndjsonLines(path.join(langDir, 'stats.ndjson'))) {
    const stats = ('stats' in record) ? record.stats : [record]
    for (const stat of stats) {
      byRef.push({ start, hash: hash(stat.ref) })
      for (const matcher of stat.matchers) {
        matchers.push({ start, hash: hash(matcher.advanced ?? matcher.string) })
      }
    }
  }
  writeIndex(byRef, path.join(langDir, 'stats-ref.index.bin'))
  writeIndex(matchers, path.join(langDir, 'stats-matcher.index.bin'))
}

function makeItemsIndexes (langDir) {
  const firstByRef = new Map()
  for (const { start, record } of ndjsonLines(path.join(langDir, 'items.ndjson'))) {
    const key = `${record.namespace}::${record.refName}`
    if (!firstByRef.has(key)) {
      firstByRef.set(key, {
        start,
        name: hash(`${record.namespace}::${record.name}`),
        refName: hash(key)
      })
    }
  }
  const entries = [...firstByRef.values()]
  writeIndex(entries.map(e => ({ start: e.start, hash: e.name })), path.join(langDir, 'items-name.index.bin'))
  writeIndex(entries.map(e => ({ start: e.start, hash: e.refName })), path.join(langDir, 'items-ref.index.bin'))
}

const languages = fs.readdirSync(DATA_DIR, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(DATA_DIR, entry.name, 'stats.ndjson')))
  .map(entry => entry.name)

for (const lang of languages) {
  const langDir = path.join(DATA_DIR, lang)
  makeStatsIndexes(langDir)
  makeItemsIndexes(langDir)
}
console.log(`Data indexes built for: ${languages.join(', ')}`)
