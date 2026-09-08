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
  await first.delete(changed);
  assert.deepEqual(await second.list(), []);
  console.log(
    JSON.stringify({
      ok: true,
      wordCount: 20000,
      bytes: original.bytes,
      roundTrip: true,
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
