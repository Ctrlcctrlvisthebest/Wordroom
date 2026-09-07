// Run with Node, not a browser. Measures data processing only, not page load/INP.
// Usage: node scripts/benchmark-wordroom.mjs [baseline-git-ref]
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as current from '../wordroom.js';

const baselineRef =
  process.argv[2] ?? '6ed193865e4be586b2bc100aedba3390d8ef22ea';
const source = execFileSync('git', ['show', `${baselineRef}:wordroom.js`], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  encoding: 'utf8',
});
const baseline = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const mapping = { word: 0, meaning: 1, example: 2, phrase: 3 };
const fixtures = [
  { name: '2k-unquoted', rows: 2000, quoted: false },
  { name: '20k-unquoted', rows: 20000, quoted: false },
  { name: '20k-quoted-multiline', rows: 20000, quoted: true },
].map((fixture) => ({
  ...fixture,
  csv: current.serializeCSV([
    ['word', 'meaning', 'example', 'phrase'],
    ...Array.from({ length: fixture.rows }, (_, index) => [
      `word${index}`,
      `meaning${index}`,
      fixture.quoted
        ? 'Long example sentence. '.repeat(6) + 'He said "hello",\nthen left.'
        : 'Long example sentence. '.repeat(8),
      'example phrase',
    ]),
  ]),
}));

function outcome(parse, input) {
  try {
    return { rows: parse(input) };
  } catch (error) {
    return { error: error.message };
  }
}

let differentialCases = 0;
function compare(input, depth = 0) {
  assert.deepEqual(
    outcome(current.parseCSV, input),
    outcome(baseline.parseCSV, input),
  );
  differentialCases++;
  if (depth < 5) {
    for (const char of ['a', ' ', ',', '"', '\r', '\n'])
      compare(input + char, depth + 1);
  }
}
compare('');
for (const { csv } of fixtures) {
  assert(Buffer.byteLength(csv) <= current.MAX_CSV_BYTES);
  const parsed = current.parseCSV(csv);
  assert.deepEqual(parsed, baseline.parseCSV(csv));
  assert.deepEqual(
    current.createWords(parsed.slice(1), mapping),
    baseline.createWords(parsed.slice(1), mapping),
  );
}

// Alternate execution order so the first implementation is not always colder.
function measure(before, after) {
  const timings = [[], []];
  const functions = [before, after];
  for (let round = 0; round < 26; round++) {
    for (const index of round % 2 ? [1, 0] : [0, 1]) {
      const start = performance.now();
      const result = functions[index]();
      const elapsed = performance.now() - start;
      assert(result.length > 0);
      if (round >= 6) timings[index].push(elapsed);
    }
  }
  const median = (values) => {
    values.sort((a, b) => a - b);
    return (values[9] + values[10]) / 2;
  };
  const beforeMs = median(timings[0]);
  const afterMs = median(timings[1]);
  return {
    beforeMedianMs: Number(beforeMs.toFixed(3)),
    afterMedianMs: Number(afterMs.toFixed(3)),
    speedup: Number((beforeMs / afterMs).toFixed(2)),
  };
}

const results = fixtures.map(({ name, csv, rows }) => ({
  name,
  rows,
  bytes: Buffer.byteLength(csv),
  parse: measure(
    () => baseline.parseCSV(csv),
    () => current.parseCSV(csv),
  ),
  // Old import validates by mapping once, then rebuilds by mapping again.
  // This isolates that data path; file reads, mapping detection and DOM are excluded.
  parseAndMap: measure(
    () => {
      const data = baseline.parseCSV(csv).slice(1);
      assert(baseline.createWords(data, mapping).length);
      return baseline.createWords(data, mapping);
    },
    () => current.createWords(current.parseCSV(csv).slice(1), mapping),
  ),
}));
console.log(
  JSON.stringify(
    {
      runtime: process.version,
      platform: `${process.platform}/${process.arch}`,
      baselineRef,
      differentialCases,
      warmupRounds: 6,
      measuredRounds: 20,
      scope:
        'Local Node synthetic CSV benchmark; no file IO, DOM, browser, or network measurements.',
      results,
    },
    null,
    2,
  ),
);
