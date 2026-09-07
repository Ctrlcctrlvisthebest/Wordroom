import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRANSLATIONS,
  clampCount,
  createStarredCSV,
  createWords,
  detectMapping,
  escapeHTML,
  parseCSV,
  serializeCSV,
  shuffled,
  translate,
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
test('自动识别西班牙语 CSV 表头', () =>
  assert.deepEqual(
    detectMapping(['palabra', 'significado', 'ejemplo', 'colocación']),
    { word: 0, meaning: 1, example: 2, phrase: 3 },
  ));
test('中英西三语文案支持变量替换和未知语言回退', () => {
  assert.equal(translate('en', 'wordCount', { count: 3 }), '3 words');
  assert.equal(
    translate('es', 'addStar', { word: 'hola' }),
    'Añadir hola a favoritas',
  );
  assert.equal(translate('unknown', 'field_word'), '单词');
});
test('三种语言包拥相同的文案键', () => {
  const expected = Object.keys(TRANSLATIONS.zh).sort();
  assert.deepEqual(Object.keys(TRANSLATIONS.en).sort(), expected);
  assert.deepEqual(Object.keys(TRANSLATIONS.es).sort(), expected);
});
test('仅创建有单词的记录，不读取未启用字段', () =>
  assert.deepEqual(
    createWords([['hello', '你好'], ['', '空'], ['world']], {
      word: 0,
      meaning: 1,
      example: null,
      phrase: null,
    }),
    [
      {
        sourceIndex: 0,
        word: 'hello',
        meaning: '你好',
        example: '',
        phrase: '',
      },
      {
        sourceIndex: 2,
        word: 'world',
        meaning: '',
        example: '',
        phrase: '',
      },
    ],
  ));
test('CSV 导出会正确处理逗号、引号和换行', () =>
  assert.equal(
    serializeCSV([
      ['word', 'example'],
      ['hello', 'He said "hello", then left.'],
      ['line', 'first\nsecond'],
    ]),
    'word,example\r\nhello,"He said ""hello"", then left."\r\nline,"first\nsecond"',
  ));
test('星标导出保留完整表头、原始列和原始行顺序', () => {
  const csv = createStarredCSV(
    ['word', 'meaning', 'notes'],
    [
      ['one', '一', 'A'],
      ['two', '二', 'B'],
      ['three', '三', 'C'],
    ],
    [2, 0, 2, 99, -1],
  );
  assert.equal(csv, 'word,meaning,notes\r\none,一,A\r\nthree,三,C');
});
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

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('GitHub 图标引用本地矢量字形，不依赖设备字体', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const icon = readFileSync(new URL('../favicon.svg', import.meta.url), 'utf8');
  assert.match(html, /rel="icon"[^>]+href="\.\/favicon\.svg\?v=1"/);
  assert.match(icon, /viewBox="0 0 64 64"/);
  assert.match(icon, /fill="#243550"/);
  assert.match(icon, /<path fill="#fff"/);
  assert.doesNotMatch(icon, /<text|<script|<image|<foreignObject/);
});

// Minimal DOM simulation: these regressions check app wiring, not browser layout.
function createUI({ mobile = false } = {}) {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../wordroom.js', import.meta.url), 'utf8');
  class Element {
    constructor(tag, attrs) {
      this.tagName = tag.toUpperCase();
      this.attrs = attrs;
      this.dataset = {};
      this.listeners = {};
      this.style = {};
      this.textContent = '';
      this.value = attrs.value || '';
      this.checked = Object.hasOwn(attrs, 'checked');
      this.disabled = Object.hasOwn(attrs, 'disabled');
      this.children = [];
      this.content = '';
      this.open = Object.hasOwn(attrs, 'open');
      const classes = new Set((attrs.class || '').split(/\s+/));
      this.classList = {
        contains: (c) => classes.has(c),
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        toggle: (c, on) => {
          const enabled = on === undefined ? !classes.has(c) : on;
          if (enabled) classes.add(c);
          else classes.delete(c);
        },
      };
      Object.entries(attrs).forEach(([key, value]) => {
        if (key.startsWith('data-'))
          this.dataset[
            key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          ] = value;
      });
    }
    set innerHTML(value) {
      this.content = value;
      this.children = elements(value);
    }
    get innerHTML() {
      return this.content;
    }
    setAttribute(key, value) {
      this.attrs[key] = value;
    }
    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }
    focus() {
      document.activeElement = this;
    }
    select() {
      this.selected = true;
    }
    scrollIntoView() {}
    remove() {}
    appendChild(child) {
      this.children.push(child);
    }
    click() {
      if (!this.disabled && this.listeners.click)
        this.listeners.click({ target: this });
    }
  }
  function elements(markup) {
    return [...markup.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)].map((match) => {
      const attrs = {};
      for (const a of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g))
        attrs[a[1]] = a[2] || '';
      return new Element(match[1], attrs);
    });
  }
  const roots = elements(html);
  function all() {
    return roots.flatMap((e) => [e, ...e.children]);
  }
  function matches(e, selector) {
    if (selector.startsWith('#')) return e.attrs.id === selector.slice(1);
    const m = selector.match(/^(\w+)?\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (m)
      return (
        (!m[1] || e.tagName === m[1].toUpperCase()) &&
        Object.hasOwn(e.attrs, m[2]) &&
        (m[3] === undefined || e.attrs[m[2]] === m[3])
      );
    return false;
  }
  const document = {
    documentElement: {},
    activeElement: null,
    title: '',
    querySelector: (s) => all().find((e) => matches(e, s)) || null,
    querySelectorAll: (s) => all().filter((e) => matches(e, s)),
    addEventListener() {},
    createElement: (tag) => new Element(tag, {}),
    body: new Element('body', {}),
  };

  const blobs = [];
  const storage = new Map();
  const context = vm.createContext({
    document,
    window: { matchMedia: () => ({ matches: mobile }) },
    localStorage: {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
    },
    Blob,
    URL: {
      createObjectURL: (blob) => {
        blobs.push(blob);
        return 'blob:test';
      },
      revokeObjectURL() {},
    },
    setTimeout: (fn) => fn(),
  });
  vm.runInContext(js.replace(/^export /gm, ''), context);
  const $ = (selector) => {
    const element = document.querySelector(selector);
    assert(element, `Missing UI element: ${selector}`);
    return element;
  };
  const language = (locale) => {
    $('#languageSelect').value = locale;
    $('#languageSelect').listeners.change({ target: $('#languageSelect') });
  };
  const upload = async (text, name = 'test.csv') => {
    $('#fileInput').listeners.change({
      target: { files: [{ name, size: text.length, text: async () => text }] },
    });
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { $, language, upload, document, blobs, html };
}

test('GitHub 页面 ID 唯一，反馈保持安全外链', () => {
  const { html } = createUI();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(
    html,
    /href="https:\/\/forms\.gle\/j6agKyoEvyPoPSjP7"\s+target="_blank"\s+rel="noopener noreferrer"/,
  );
});

test('手机默认收起词表，桌面默认展开，语言切换不重置用户选择', () => {
  const desktop = createUI();
  const mobile = createUI({ mobile: true });
  assert.equal(desktop.$('#libraryPanel').open, true);
  assert.equal(mobile.$('#libraryPanel').open, false);
  mobile.$('#libraryPanel').open = true;
  mobile.language('es');
  assert.equal(mobile.$('#libraryPanel').open, true);
  assert.equal(mobile.$('#libraryTitle').textContent, 'Lista y ajustes');
});

test('翻面样式、星标和前后导航状态保持一致', () => {
  const { $ } = createUI();
  assert.equal($('#prev').disabled, true);
  assert.equal($('#card').classList.contains('is-flipped'), false);
  $('#flip').click();
  assert.equal($('#card').classList.contains('is-flipped'), true);
  $('#cardStar').click();
  assert.equal($('#cardStar').attrs['aria-pressed'], 'true');
  assert.equal($('#card').classList.contains('is-flipped'), true);
  $('#next').click();
  assert.equal($('#card').classList.contains('is-flipped'), false);
  assert.equal($('#prev').disabled, false);
  $('#prev').click();
  assert.equal($('#cardStar').attrs['aria-pressed'], 'true');
});

test('模式切换同步可访问状态，抽词只显示词和造句框', async () => {
  const { $, upload } = createUI();
  await upload(
    'word,meaning,example,phrase\nhello,secret-meaning,secret-example,secret-phrase',
  );
  $('#drawTab').click();
  assert.equal($('#drawTab').attrs['aria-pressed'], 'true');
  assert.equal($('#cardsTab').attrs['aria-pressed'], 'false');
  assert.equal($('#cardsView').classList.contains('hide'), true);
  assert.equal($('#drawView').classList.contains('hide'), false);
  assert.match($('#drawGrid').innerHTML, /hello/);
  assert.doesNotMatch($('#drawGrid').innerHTML, /secret-/);
  $('#cardsTab').click();
  assert.equal($('#cardsTab').attrs['aria-pressed'], 'true');
  assert.equal($('#drawView').classList.contains('hide'), true);
});

test('造句和星标经过三语切换仍保留，CSV 导出保留原始列', async () => {
  const { $, upload, language, document, blobs } = createUI();
  await upload('word,meaning,extra\nhello,你好,keep-this-column');
  const textarea = document.querySelectorAll('[data-answer]')[0];
  textarea.value = 'I say hello.';
  textarea.listeners.input({ target: textarea });
  document.querySelectorAll('[data-star]')[0].click();
  for (const locale of ['en', 'es', 'zh']) {
    language(locale);
    assert.match($('#drawGrid').innerHTML, /I say hello\./);
    assert.equal($('#cardStar').attrs['aria-pressed'], 'true');
    assert.equal($('#exportBtn').disabled, false);
  }
  $('#exportBtn').click();
  assert.equal(
    await blobs[0].text(),
    'word,meaning,extra\r\nhello,你好,keep-this-column',
  );
});

test('仅单词 CSV、可选字段取消和错误文件不会破坏页面', async () => {
  const { $, upload } = createUI();
  await upload('word,meaning\nhello,你好');
  const meaning = $('[data-include="meaning"]');
  meaning.checked = false;
  meaning.listeners.change({ target: meaning });
  assert.doesNotMatch($('#mapping').innerHTML, /map-meaning/);
  $('#flip').click();
  assert.doesNotMatch($('#card').innerHTML, /你好/);
  await upload('word\none\ntwo');
  assert.equal($('#count').textContent, '2 个单词');
  assert.doesNotMatch(
    $('#mapping').innerHTML,
    /map-meaning|map-example|map-phrase/,
  );
  await upload('word\n"broken');
  assert.equal($('#count').textContent, '2 个单词');
  assert.match($('#message').textContent, /未闭合/);
  await upload('word\nhello', 'not-csv.txt');
  assert.match($('#message').textContent, /\.csv/);
});
