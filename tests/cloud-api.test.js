import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import {
  newSyncCode,
  validSyncCode,
  validateSnapshot,
  MAX_CLOUD_BYTES,
} from '../cloud-data.js';
import { CloudClient } from '../cloud-client.js';

const origin = 'https://ctrlcctrlvisthebest.github.io';
const snapshot = () => ({
  schemaVersion: 1,
  name: 'Test.csv',
  headers: ['word', 'meaning', 'extra'],
  rows: [
    [' hello ', ' 你好 ', '"raw",\n'],
    ['world', '世界', ''],
  ],
  mapping: { word: 0, meaning: 1, example: null, phrase: null },
  starred: [1],
});
let mf, db, workerScript;
before(async () => {
  const result = await build({
    entryPoints: [new URL('../server/worker.ts', import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
  });
  workerScript = result.outputFiles[0].text;
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: result.outputFiles[0].text,
      compatibilityDate: '2026-09-07',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      bindings: { ALLOWED_ORIGINS: origin },
      ratelimits: {
        REQUEST_LIMIT: {
          namespace_id: '2001',
          simple: { limit: 10000, period: 60 },
        },
        WRITE_LIMIT: {
          namespace_id: '2002',
          simple: { limit: 10000, period: 60 },
        },
      },
    }),
  );
  db = await mf.getD1Database('DB');
  const migration = readFileSync(
    new URL('../server/migrations/0001_cloud_library.sql', import.meta.url),
    'utf8',
  );
  for (const statement of migration.split(';').filter((part) => part.trim()))
    await db.prepare(statement).run();
});
after(async () => {
  await mf?.dispose();
});
const request = (code, path = '', options = {}) =>
  mf.dispatchFetch('https://local.test/v1/libraries' + path, {
    ...options,
    headers: {
      Origin: origin,
      Authorization: 'Bearer ' + code,
      ...options.headers,
    },
  });
const client = (code = newSyncCode()) =>
  new CloudClient('https://local.test', code, (url, options) => {
    const headers = new Headers(options.headers);
    headers.set('Origin', origin);
    return mf.dispatchFetch(url, { ...options, headers });
  });

void test('同步码使用独立高熵随机值，拒绝非法凭证', () => {
  const codes = Array.from({ length: 100 }, newSyncCode);
  assert.equal(new Set(codes).size, 100);
  assert(codes.every(validSyncCode));
  for (const code of ['', '123456', 'wr1_' + 'a'.repeat(63), null, 7])
    assert.equal(validSyncCode(code), false);
});
void test('云端快照校验保留完整原始列并拒绝无效映射和星标', () => {
  assert.deepEqual(validateSnapshot(snapshot()).snapshot, snapshot());
  const cases = [
    null,
    [],
    {},
    { ...snapshot(), schemaVersion: 2 },
    { ...snapshot(), name: '' },
    { ...snapshot(), headers: [] },
    { ...snapshot(), rows: [['a', {}, '']] },
    { ...snapshot(), rows: [['a', 'b', 'c', 'd']] },
    {
      ...snapshot(),
      mapping: { word: 0, meaning: 0, example: null, phrase: null },
    },
    { ...snapshot(), starred: [1, 1] },
    { ...snapshot(), starred: [99] },
    { ...snapshot(), rows: [['', '', '']] },
  ];
  for (const value of cases)
    assert.throws(() => validateSnapshot(value), /invalidSnapshot/);
});
const multiSnapshot = () => ({
  schemaVersion: 2,
  name: 'Combined library',
  sources: [
    {
      name: 'one.csv',
      headers: ['word', 'meaning', 'unused'],
      rows: [
        [' same ', ' 一 ', 'original'],
        ['', 'skip', 'raw'],
      ],
      mapping: { word: 0, meaning: 1, example: null, phrase: null },
    },
    {
      name: 'two.csv',
      headers: ['ejemplo', 'palabra'],
      rows: [['"same",\nagain', 'same']],
      mapping: { word: 1, meaning: null, example: 0, phrase: null },
    },
  ],
  starred: [2],
});

void test('多来源快照可跨设备存取，旧版快照兼容且词数不计空词行', async () => {
  const code = newSyncCode(),
    a = client(code),
    b = client(code);
  const id = crypto.randomUUID();
  const saved = await a.save(id, multiSnapshot());
  assert.equal(saved.wordCount, 2);
  const loaded = await b.load(id);
  assert.deepEqual(loaded.validated.snapshot, multiSnapshot());
  assert.deepEqual(
    loaded.validated.words.map((word) => [word.sourceIndex, word.word]),
    [
      [0, 'same'],
      [2, 'same'],
    ],
  );
  const legacy = await b.save(id, snapshot(), saved.revision);
  assert.deepEqual((await a.load(id)).validated.snapshot, snapshot());
  await b.delete(legacy);
});

void test('多来源快照拒绝异常文件、坏映射、空词表、错误星标和聚合超限', async () => {
  const value = multiSnapshot();
  const cases = [
    { ...value, sources: [] },
    { ...value, sources: [null] },
    { ...value, sources: Array(21).fill(value.sources[0]) },
    { ...value, sources: [{ ...value.sources[0], name: '' }] },
    {
      ...value,
      sources: [
        {
          ...value.sources[0],
          mapping: { word: 0, meaning: 0, example: null, phrase: null },
        },
      ],
    },
    {
      ...value,
      sources: [{ ...value.sources[0], rows: [['', 'only meaning']] }],
    },
    {
      ...value,
      sources: [{ ...value.sources[0], headers: Array(101).fill('word') }],
    },
    {
      ...value,
      sources: [
        value.sources[0],
        { ...value.sources[1], rows: Array(19999).fill(['example', 'word']) },
      ],
    },
    { ...value, starred: [1] },
    { ...value, starred: [2, 2] },
    { ...value, starred: [3] },
  ];
  const code = newSyncCode();
  for (const bad of cases) {
    assert.throws(() => validateSnapshot(bad), /invalidSnapshot/);
    const response = await request(code, '/' + crypto.randomUUID(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'If-None-Match': '*' },
      body: JSON.stringify(bad),
    });
    assert.equal(response.status, 400);
  }
  assert.deepEqual(await client(code).list(), []);
  assert.throws(
    () =>
      validateSnapshot({
        ...value,
        sources: [
          {
            ...value.sources[0],
            rows: [['word', 'x'.repeat(MAX_CLOUD_BYTES)]],
          },
        ],
        starred: [],
      }),
    /cloudTooLarge/,
  );
});

void test('鉴权、CORS、非缓存响应和协议限制', async () => {
  assert.equal((await request('bad')).status, 401);
  const rejected = await request(newSyncCode(), '', {
    headers: { Origin: 'https://evil.test' },
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('Access-Control-Allow-Origin'), null);
  const preflight = await request('', '', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
  assert.match(
    preflight.headers.get('Access-Control-Allow-Headers'),
    /If-Match/,
  );
  const result = await request(newSyncCode());
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(
    (
      await request(newSyncCode(), '/' + crypto.randomUUID(), {
        method: 'POST',
      })
    ).status,
    405,
  );
  assert.throws(
    () => new CloudClient('http://untrusted.test', newSyncCode()),
    /notConfigured/,
  );
});
void test('跨设备保存、恢复、更新和删除；其他同步码不能读写', async () => {
  const code = newSyncCode(),
    a = client(code),
    b = client(code),
    stranger = client();
  assert.deepEqual(await a.list(), []);
  const id = crypto.randomUUID();
  const saved = await a.save(id, snapshot());
  assert.equal((await b.list())[0].id, id);
  assert.deepEqual((await b.load(id)).validated.snapshot, snapshot());
  assert.deepEqual(await stranger.list(), []);
  await assert.rejects(stranger.load(id), /notFound/);
  await assert.rejects(
    stranger.save(id, snapshot(), saved.revision),
    /conflict/,
  );
  await assert.rejects(stranger.delete(saved), /conflict/);
  const updated = await b.save(
    id,
    { ...snapshot(), starred: [0] },
    saved.revision,
  );
  assert.notEqual(updated.revision, saved.revision);
  await assert.rejects(a.save(id, snapshot(), saved.revision), /conflict/);
  await assert.rejects(a.delete(saved), /conflict/);
  assert.deepEqual((await a.load(id)).validated.snapshot.starred, [0]);
  await b.delete(updated);
  assert.deepEqual(await a.list(), []);
  await assert.rejects(a.load(id), /notFound/);
  const remaining = await db
    .prepare('SELECT COUNT(*) AS n FROM library_parts WHERE library_id=?')
    .bind(id)
    .first();
  assert.equal(remaining.n, 0);
});
void test('并发更新只有一个获胜，失败不会混合或删除分片', async () => {
  const a = client(),
    id = crypto.randomUUID();
  const initial = await a.save(id, snapshot());
  const results = await Promise.allSettled([
    a.save(
      id,
      { ...snapshot(), name: 'A.csv', starred: [0] },
      initial.revision,
    ),
    a.save(id, { ...snapshot(), name: 'B.csv', starred: [] }, initial.revision),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const winner = results.find((r) => r.status === 'fulfilled').value;
  const loaded = await a.load(id);
  assert.equal(loaded.entry.revision, winner.revision);
  assert.equal(loaded.validated.snapshot.name, winner.name);
});
void test('多 MB、非 BMP 字符跨分片保存后完全一致', async () => {
  const a = client(),
    id = crypto.randomUUID();
  const large = {
    ...snapshot(),
    rows: [['word', '例句😀'.repeat(260000), ' tail ']],
    starred: [0],
  };
  const saved = await a.save(id, large);
  assert(saved.bytes > 2000000);
  assert.deepEqual((await a.load(id)).validated.snapshot, large);
  await a.delete(saved);
});
void test('20,000 个词可保存和恢复，星标原始行号不变', async () => {
  const a = client(),
    id = crypto.randomUUID();
  const many = {
    ...snapshot(),
    rows: Array.from({ length: 20000 }, (_, i) => [
      'w' + i,
      'meaning',
      'unused',
    ]),
    starred: [0, 19999],
  };
  const saved = await a.save(id, many);
  assert.equal(saved.wordCount, 20000);
  assert.deepEqual((await a.load(id)).validated.snapshot, many);
  await a.delete(saved);
});
void test('服务端拒绝无效 JSON、超大请求和遗漏条件写入', async () => {
  const code = newSyncCode(),
    id = crypto.randomUUID();
  const options = {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-None-Match': '*' },
  };
  for (const body of [
    '{',
    '{}',
    JSON.stringify({ ...snapshot(), starred: [-1] }),
  ])
    assert.equal(
      (await request(code, '/' + id, { ...options, body })).status,
      400,
    );
  assert.equal(
    (await request(code, '/' + id, { method: 'PUT', body: '{}' })).status,
    428,
  );
  assert.equal(
    (
      await request(code, '/' + id, {
        ...options,
        body: 'x'.repeat(MAX_CLOUD_BYTES + 1),
      })
    ).status,
    413,
  );
  assert.deepEqual(await client(code).list(), []);
});
void test('列表数上限包括并发新增，超限不影响既有词表', async () => {
  const a = client();
  for (let i = 0; i < 19; i++) await a.save(crypto.randomUUID(), snapshot());
  const results = await Promise.allSettled([
    a.save(crypto.randomUUID(), snapshot()),
    a.save(crypto.randomUUID(), snapshot()),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const lists = await a.list();
  assert.equal(lists.length, 20);
  await assert.rejects(
    a.save(crypto.randomUUID(), snapshot()),
    /quotaExceeded/,
  );
  await a.save(lists[0].id, { ...snapshot(), starred: [] }, lists[0].revision);
});

void test('总容量配额由服务端执行，缩小已有词表后可继续新增', async () => {
  const code = newSyncCode(),
    a = client(code);
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(code),
  );
  const owner = Buffer.from(digest).toString('hex');
  const records = Array.from({ length: 4 }, () => ({
    id: crypto.randomUUID(),
    revision: crypto.randomUUID(),
  }));
  for (const record of records) {
    await db
      .prepare(
        'INSERT INTO libraries(owner,id,name,revision,word_count,byte_length,updated_at) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(
        owner,
        record.id,
        'quota fixture',
        record.revision,
        1,
        MAX_CLOUD_BYTES,
        Date.now(),
      )
      .run();
  }
  await assert.rejects(
    a.save(crypto.randomUUID(), snapshot()),
    /quotaExceeded/,
  );
  await a.save(records[0].id, snapshot(), records[0].revision);
  await a.save(crypto.randomUUID(), snapshot());
  assert.equal((await a.list()).length, 5);
});

void test('真实限流绑定拒绝超频访问并返回重试提示', async () => {
  const limited = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: workerScript,
      compatibilityDate: '2026-09-07',
      compatibilityFlags: ['nodejs_compat'],
      d1Databases: ['DB'],
      bindings: { ALLOWED_ORIGINS: origin },
      ratelimits: {
        REQUEST_LIMIT: {
          namespace_id: '9991',
          simple: { limit: 1, period: 60 },
        },
        WRITE_LIMIT: { namespace_id: '9992', simple: { limit: 1, period: 60 } },
      },
    }),
  );
  try {
    const headers = {
      Origin: origin,
      Authorization: 'Bearer ' + newSyncCode(),
    };
    assert.equal(
      (
        await limited.dispatchFetch('https://local.test/v1/libraries/bad-id', {
          headers,
        })
      ).status,
      400,
    );
    const denied = await limited.dispatchFetch(
      'https://local.test/v1/libraries/bad-id',
      { headers },
    );
    assert.equal(denied.status, 429);
    assert.equal(denied.headers.get('Retry-After'), '60');
  } finally {
    await limited.dispose();
  }
});
