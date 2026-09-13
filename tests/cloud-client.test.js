import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudClient } from '../cloud-client.js';
import { newSyncCode } from '../cloud-data.js';

test('默认 fetch 保留浏览器全局接收者，避免 Illegal invocation', async (t) => {
  const code = newSyncCode();
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async function (url, options) {
    // Model Window.fetch's receiver check; Node's native fetch lacks it.
    assert.equal(this, globalThis, 'fetch must not receive a CloudClient');
    assert.equal(url, 'https://cloud.test/v1/libraries');
    assert.equal(options.headers.Authorization, `Bearer ${code}`);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.referrerPolicy, 'no-referrer');
    calls++;
    return Response.json({ libraries: [] });
  });
  const client = new CloudClient('https://cloud.test', code);
  assert.deepEqual(await client.list(), []);
  assert.equal(calls, 1);
});

test('自定义 fetch 仍可注入，不调用默认网络实现', async (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Unexpected network request');
  });
  let calls = 0;
  const client = new CloudClient(
    'https://cloud.test',
    newSyncCode(),
    async () => {
      calls++;
      return Response.json({ libraries: [] });
    },
  );
  assert.deepEqual(await client.list(), []);
  assert.equal(calls, 1);
});
