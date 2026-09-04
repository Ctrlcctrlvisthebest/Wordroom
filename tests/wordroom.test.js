import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampCount,
  createWords,
  detectMapping,
  escapeHTML,
  parseCSV,
  shuffled,
} from '../wordroom.js';

test('解析 BOM、CRLF、逗号、换行和转义引号', () => {
  const rows = parseCSV(
    '\uFEFFword,meaning,example\r\nhello,你好,"He said ""hello"", then left."\r\nline,"多\n行",ok',
  );
  assert.deepEqual(rows, [
    ['word', 'meaning', 'example'],
    ['hello', '你好', 'He said "hello", then left.'],
    ['line', '多\n行', 'ok'],
  ]);
});
test('未闭合引号会明确报错', () =>
  assert.throws(() => parseCSV('word,example\na,"broken'), /未闭合/));
test('自动识别可选字段，缺少字段保持为空', () =>
  assert.deepEqual(detectMapping(['单词', '中文释义']), {
    word: 0,
    meaning: 1,
    example: null,
    phrase: null,
  }));
test('自动识别不会把同一列分配给多个字段', () =>
  assert.deepEqual(detectMapping(['word', 'meaning phrase']), {
    word: 0,
    meaning: 1,
    example: null,
    phrase: null,
  }));
test('仅创建有单词的记录，不读取未启用字段', () =>
  assert.deepEqual(
    createWords([['hello', '你好'], ['', '空'], ['world']], {
      word: 0,
      meaning: 1,
      example: null,
      phrase: null,
    }),
    [
      { word: 'hello', meaning: '你好', example: '', phrase: '' },
      { word: 'world', meaning: '', example: '', phrase: '' },
    ],
  ));
test('抽词数量始终限制在有效范围', () => {
  assert.equal(clampCount('', 5), 1);
  assert.equal(clampCount(-2, 5), 1);
  assert.equal(clampCount(99, 5), 5);
  assert.equal(clampCount(3, 0), 0);
});
test('洗牌不修改原数组且不丢元素', () => {
  const source = [1, 2, 3, 4],
    result = shuffled(source, () => 0);
  assert.deepEqual(source, [1, 2, 3, 4]);
  assert.deepEqual(
    [...result].sort((a, b) => a - b),
    source,
  );
});
test('用户内容输出前会转义', () =>
  assert.equal(
    escapeHTML('<img onerror="x">'),
    '&lt;img onerror=&quot;x&quot;&gt;',
  ));
