import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudClient, cloudErrorCode, uncertainSave } from '../cloud-client.js';
import { newSyncCode } from '../cloud-data.js';

void test('默认 fetch 保留浏览器全局接收者，避免 Illegal invocation', async (t) => {
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

void test('自定义 fetch 仍可注入，不调用默认网络实现', async (t) => {
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

void test('云端诊断只暴露固定错误代码和 HTTP 状态，不回显服务端内容或同步码', async () => {
  const code = newSyncCode();
  for (const [response, expected, status] of [
    [
      Response.json({ error: `invalid ${code}` }, { status: 500 }),
      'serverError',
      500,
    ],
    [new Response(`<html>${code}</html>`, { status: 502 }), 'serverError', 502],
    [
      Response.json({ error: 'originDenied' }, { status: 403 }),
      'originDenied',
      403,
    ],
    [
      Response.json({ error: 'rateLimited' }, { status: 429 }),
      'rateLimited',
      429,
    ],
  ]) {
    const client = new CloudClient(
      'https://cloud.test',
      code,
      async () => response,
    );
    await assert.rejects(client.list(), (error) => {
      assert.equal(error.message, expected);
      assert.equal(error.status, status);
      assert(!JSON.stringify(error).includes(code));
      assert(!String(error).includes(code));
      return true;
    });
  }
});

void test('网络和超时错误归类明确且不会泄漏底层异常内容', async () => {
  const code = newSyncCode();
  for (const [error, expected] of [
    [new TypeError(`Failed to fetch ${code}`), 'networkError'],
    [new DOMException(code, 'AbortError'), 'timeout'],
    [new Error(code), 'serverError'],
  ]) {
    const client = new CloudClient('https://cloud.test', code, async () => {
      throw error;
    });
    await assert.rejects(client.list(), { message: expected });
  }
  assert.equal(cloudErrorCode(new Error(code)), 'serverError');
  assert.equal(uncertainSave(new Error('timeout')), true);
  assert.equal(uncertainSave(new Error('networkError')), true);
  assert.equal(uncertainSave(new Error('conflict')), true);
  assert.equal(uncertainSave(new Error('quotaExceeded')), false);
});
