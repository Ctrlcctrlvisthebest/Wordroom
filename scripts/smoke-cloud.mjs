// Explicit remote smoke test: only creates synthetic lists under a new random
// code, and deletes those same lists afterward. Never prints the sync code.
import assert from 'node:assert/strict';
import { CloudClient } from '../cloud-client.js';
import { newSyncCode } from '../cloud-data.js';
import { CLOUD_API_URL } from '../cloud-config.js';

const origin = 'https://ctrlcctrlvisthebest.github.io';
const fetcher = (url, options) =>
  fetch(url, { ...options, headers: { ...options.headers, Origin: origin } });
const code = newSyncCode();
const first = new CloudClient(CLOUD_API_URL, code, fetcher);
const second = new CloudClient(CLOUD_API_URL, code, fetcher);
const stranger = new CloudClient(CLOUD_API_URL, newSyncCode(), fetcher);
const id = crypto.randomUUID();
const snapshot = {
  schemaVersion: 1,
  name: 'Wordroom deployment smoke test.csv',
  headers: ['word', 'meaning', 'example', 'unused'],
  rows: Array.from({ length: 20000 }, (_, index) => [
    `word${index}`,
    ' 释义 ',
    'A synthetic example with "quotes", and a new line.\n'.repeat(3),
    'original',
  ]),
  mapping: { word: 0, meaning: 1, example: 2, phrase: null },
  starred: [0, 19999],
};
try {
  assert.deepEqual(await first.list(), []);
  const original = await first.save(id, snapshot);
  assert.equal(original.wordCount, 20000);
  assert.deepEqual((await second.load(id)).validated.snapshot, snapshot);
  assert.deepEqual(await stranger.list(), []);
  await assert.rejects(stranger.load(id), /notFound/);
  const changed = await second.save(
    id,
    { ...snapshot, starred: [10] },
    original.revision,
  );
  await assert.rejects(first.save(id, snapshot, original.revision), /conflict/);
  assert.deepEqual((await first.load(id)).validated.snapshot.starred, [10]);
  const combined = {
    schemaVersion: 2,
    name: 'Synthetic combined library',
    sources: [
      {
        name: 'one.csv',
        headers: ['word', 'meaning'],
        rows: [
          ['same', ' 一 '],
          ['', 'skip'],
        ],
        mapping: { word: 0, meaning: 1, example: null, phrase: null },
      },
      {
        name: 'two.csv',
        headers: ['ejemplo', 'palabra', 'unused'],
        rows: [['Line one\nLine two', 'same', 'raw']],
        mapping: { word: 1, meaning: null, example: 0, phrase: null },
      },
    ],
    starred: [2],
  };
  const merged = await first.save(id, combined, changed.revision);
  const restored = (await second.load(id)).validated;
  assert.deepEqual(restored.snapshot, combined);
  assert.equal(merged.wordCount, 2);
  assert.deepEqual(
    restored.words.map((word) => word.sourceIndex),
    [0, 2],
  );
  await first.delete(merged);
  assert.deepEqual(await second.list(), []);
  console.log(
    JSON.stringify({
      ok: true,
      wordCount: 20000,
      bytes: original.bytes,
      roundTrip: true,
      multiCSVRoundTrip: true,
      isolation: true,
      conflictProtection: true,
      deletion: true,
    }),
  );
} finally {
  // The random identity and exact ID ensure this never touches user-owned lists.
  const remaining = (await first.list()).find((entry) => entry.id === id);
  if (remaining) await first.delete(remaining);
}
