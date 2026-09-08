import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { startCloud, CLOUD_TEXT } from '../wordroom-cloud.js';
import { newSyncCode, validateSnapshot } from '../cloud-data.js';
import {
  TRANSLATIONS,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  MAX_CSV_COLUMNS,
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

void test('解析 BOM、CRLF、逗号、换行和转义引号', () => {
  const rows = parseCSV(
    '\uFEFFword,meaning,example\r\nhello,你好,"He said ""hello"", then left."\r\nline,"多\n行",ok',
  );
  assert.deepEqual(rows, [
    ['word', 'meaning', 'example'],
    ['hello', '你好', 'He said "hello", then left.'],
    ['line', '多\n行', 'ok'],
  ]);
});
void test('未闭合引号会明确报错', () =>
  assert.throws(() => parseCSV('word,example\na,"broken'), /未闭合/));
void test('自动识别可选字段，缺少字段保持为空', () =>
  assert.deepEqual(detectMapping(['单词', '中文释义']), {
    word: 0,
    meaning: 1,
    example: null,
    phrase: null,
  }));
void test('自动识别不会把同一列分配给多个字段', () =>
  assert.deepEqual(detectMapping(['word', 'meaning phrase']), {
    word: 0,
    meaning: 1,
    example: null,
    phrase: null,
  }));
void test('自动识别西班牙语 CSV 表头', () =>
  assert.deepEqual(
    detectMapping(['palabra', 'significado', 'ejemplo', 'colocación']),
    { word: 0, meaning: 1, example: 2, phrase: 3 },
  ));
void test('中英西三语文案支持变量替换和未知语言回退', () => {
  assert.equal(translate('en', 'wordCount', { count: 3 }), '3 words');
  assert.equal(
    translate('es', 'addStar', { word: 'hola' }),
    'Añadir hola a favoritas',
  );
  assert.equal(translate('unknown', 'field_word'), '单词');
});
void test('三种语言包拥相同的文案键', () => {
  const expected = Object.keys(TRANSLATIONS.zh).sort();
  assert.deepEqual(Object.keys(TRANSLATIONS.en).sort(), expected);
  assert.deepEqual(Object.keys(TRANSLATIONS.es).sort(), expected);
});
void test('仅创建有单词的记录，不读取未启用字段', () =>
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
void test('CSV 导出会正确处理逗号、引号和换行', () =>
  assert.equal(
    serializeCSV([
      ['word', 'example'],
      ['hello', 'He said "hello", then left.'],
      ['line', 'first\nsecond'],
    ]),
    'word,example\r\nhello,"He said ""hello"", then left."\r\nline,"first\nsecond"',
  ));
void test('星标导出保留完整表头、原始列和原始行顺序', () => {
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
void test('抽词数量始终限制在有效范围', () => {
  assert.equal(clampCount('', 5), 1);
  assert.equal(clampCount(-2, 5), 1);
  assert.equal(clampCount(99, 5), 5);
  assert.equal(clampCount(3, 0), 0);
});
void test('洗牌不修改原数组且不丢元素', () => {
  const source = [1, 2, 3, 4],
    result = shuffled(source, () => 0);
  assert.deepEqual(source, [1, 2, 3, 4]);
  assert.deepEqual(
    [...result].sort((a, b) => a - b),
    source,
  );
});
void test('用户内容输出前会转义', () =>
  assert.equal(
    escapeHTML('<img onerror="x">'),
    '&lt;img onerror=&quot;x&quot;&gt;',
  ));

void test('GitHub 图标引用本地矢量字形，不依赖设备字体', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const icon = readFileSync(new URL('../favicon.svg', import.meta.url), 'utf8');
  assert.match(html, /rel="icon"[^>]+href="\.\/favicon\.svg\?v=1"/);
  assert.match(icon, /viewBox="0 0 64 64"/);
  assert.match(icon, /fill="#243550"/);
  assert.match(icon, /<path fill="#fff"/);
  assert.doesNotMatch(icon, /<text|<script|<image|<foreignObject/);
});

// Minimal DOM simulation: these regressions check app wiring, not browser layout.
function createUI({
  mobile = false,
  savedLocale,
  storageBlocked = false,
  downloadFailure = false,
} = {}) {
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
      const previous = this.listeners[name];
      this.listeners[name] = previous
        ? (event) => {
            previous(event);
            return listener(event);
          }
        : listener;
    }
    focus() {
      document.activeElement = this;
    }
    remove() {}
    appendChild(child) {
      this.children.push(child);
    }
    click() {
      if (this.tagName === 'A' && downloadFailure)
        throw new Error('Download blocked');
      if (!this.disabled && this.listeners.click)
        return this.listeners.click({ target: this });
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
  const storage = new Map([['wordroom-language', savedLocale]]);
  const context = vm.createContext({
    document,
    window: { matchMedia: () => ({ matches: mobile }) },
    localStorage: {
      getItem: (k) => {
        if (storageBlocked) throw new Error('Storage blocked');
        return storage.get(k);
      },
      setItem: (k, v) => {
        if (storageBlocked) throw new Error('Storage blocked');
        storage.set(k, v);
      },
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
  // Count mapping passes without exposing test hooks in the application.
  vm.runInContext(
    `globalThis.wordMappingCalls = 0;
    const originalCreateWords = createWords;
    createWords = (...args) => {
      wordMappingCalls++;
      return originalCreateWords(...args);
    };`,
    context,
  );
  const $ = (selector) => {
    const element = document.querySelector(selector);
    assert(element, `Missing UI element: ${selector}`);
    return element;
  };
  const language = (locale) => {
    $('#languageSelect').value = locale;
    $('#languageSelect').listeners.change({ target: $('#languageSelect') });
  };
  const uploadFile = async (file) => {
    $('#fileInput').listeners.change({
      target: { files: file ? [file] : [] },
    });
    await new Promise((resolve) => setImmediate(resolve));
  };
  const upload = (text, name = 'test.csv') =>
    uploadFile({ name, size: Buffer.byteLength(text), text: async () => text });
  return {
    $,
    language,
    upload,
    uploadFile,
    document,
    blobs,
    html,
    getMappingCalls: () => context.wordMappingCalls,
    studyApp: vm.runInContext('studyApp', context),
  };
}

void test('CSV 单元格边界：空文件、尾随分隔符、混合换行和连续引号', () => {
  for (const blank of ['', '\uFEFF', '\r\n', ',,', '""', '" \r\n "']) {
    assert.deepEqual(parseCSV(blank), []);
  }
  assert.deepEqual(parseCSV('a,\r\nb,,\rc,""\n'), [
    ['a', ''],
    ['b', '', ''],
    ['c', ''],
  ]);
  assert.deepEqual(parseCSV('"""",x\r"a\r\nb"\nlast'), [
    ['"', 'x'],
    ['a\r\nb'],
    ['last'],
  ]);
  for (const invalid of ['"a" ', ' "a"', 'a"b', '"a""']) {
    assert.throws(() => parseCSV(invalid));
  }
});

void test('长例句和大量转义引号仍完整保留原始内容', () => {
  const example = ' 长例句, "hello"\r\n'.repeat(20000);
  const original = [
    ['word', 'example'],
    [' hello ', example],
  ];
  const parsed = parseCSV(serializeCSV(original));
  assert.deepEqual(parsed, original);
  assert.equal(
    createStarredCSV(parsed[0], parsed.slice(1), [0]),
    serializeCSV(original),
  );
});

void test('空单词行跳过可选字段处理，原始行号保持不变', () => {
  const blank = [' '];
  Object.defineProperty(blank, 1, {
    get() {
      throw new Error('Unused field read');
    },
  });
  const words = createWords([blank, [' valid ', ' meaning ']], {
    word: 0,
    meaning: 1,
  });
  assert.equal(words.length, 1);
  assert.equal(words[0].sourceIndex, 1);
  assert.equal(words[0].meaning, 'meaning');
});

void test('导入和映射各只生成一次单词数据，翻卡星标不重复生成', async () => {
  const { $, upload, getMappingCalls } = createUI();
  assert.equal(getMappingCalls(), 0);
  await upload('word,meaning\nhello,你好');
  assert.equal(getMappingCalls(), 1);
  const box = $('[data-include="meaning"]');
  box.checked = false;
  box.listeners.change({ target: box });
  assert.equal(getMappingCalls(), 2);
  $('#flip').click();
  $('#cardStar').click();
  $('#drawBtn').click();
  assert.equal(getMappingCalls(), 2);
  await upload('word,meaning\n,没有单词');
  assert.equal(getMappingCalls(), 3);
  assert.match($('#card').innerHTML, /hello/);
  assert.equal($('#cardStar').attrs['aria-pressed'], 'true');
});

void test('更换单词列仅保留同一原始行且单词未变的星标', async () => {
  const { $, upload, document, blobs } = createUI();
  await upload('word,alternate\nkeep,keep\nchange,changed');
  document.querySelectorAll('[data-star]').forEach((button) => button.click());
  assert.equal($('#exportBtn').textContent, '导出星标（2）');
  const select = $('#map-word');
  select.value = '1';
  select.listeners.change({ target: select });
  assert.equal($('#exportBtn').textContent, '导出星标（1）');
  $('#exportBtn').click();
  assert.equal(await blobs[0].text(), 'word,alternate\r\nkeep,keep');
});

function cloudUI(options = {}) {
  const ui = createUI();
  const saved = new Map();
  const rows = new Map();
  let loads = 0,
    saves = 0;
  const api = {
    list: async () =>
      [...rows.values()].map(({ snapshot: _snapshot, ...entry }) => entry),
    save: async (id, snapshot, revision) => {
      saves++;
      if (rows.has(id) && rows.get(id).revision !== revision)
        throw new Error('conflict');
      const entry = {
        id,
        revision: crypto.randomUUID(),
        name: snapshot.name,
        wordCount: snapshot.rows.length,
        updatedAt: Date.now(),
      };
      rows.set(id, {
        ...entry,
        snapshot: JSON.parse(JSON.stringify(snapshot)),
      });
      return entry;
    },
    load: async (id) => {
      loads++;
      const { snapshot, ...entry } = rows.get(id);
      return { entry, validated: validateSnapshot(snapshot) };
    },
    delete: async (entry) => {
      rows.delete(entry.id);
    },
  };
  startCloud(ui.studyApp, {
    document: ui.document,
    storage: {
      getItem: (key) => saved.get(key),
      setItem: (key, value) => saved.set(key, value),
      removeItem: (key) => saved.delete(key),
    },
    client: () => api,
    confirm: () => true,
    ...options,
  });
  return {
    ...ui,
    api,
    rows,
    saved,
    getLoads: () => loads,
    getSaves: () => saves,
  };
}

void test('云端三语文案完整，切换语言不影响原页面', () => {
  assert.deepEqual(
    Object.keys(CLOUD_TEXT.en).sort(),
    Object.keys(CLOUD_TEXT.zh).sort(),
  );
  assert.deepEqual(
    Object.keys(CLOUD_TEXT.es).sort(),
    Object.keys(CLOUD_TEXT.zh).sort(),
  );
  const ui = cloudUI();
  ui.language('en');
  assert.equal(ui.$('#cloudSave').textContent, 'Save current list');
  assert.equal(ui.$('#libraryTitle').textContent, 'Word list & settings');
  ui.language('es');
  assert.equal(ui.$('#cloudSave').textContent, 'Guardar lista actual');
});

void test('云端保存恢复完整 CSV、映射和星标，不上传造句', async () => {
  const ui = cloudUI();
  await ui.upload('word,meaning,notes\n hello , 你好 ,保留原列');
  ui.$('#cardStar').click();
  const input = ui.document.querySelectorAll('[data-answer]')[0];
  input.value = 'Private sentence draft.';
  input.listeners.input({ target: input });
  assert.equal(ui.getSaves(), 0);
  await ui.$('#cloudCreate').click();
  assert.equal(ui.getSaves(), 0);
  assert.equal(ui.getLoads(), 0);
  await ui.$('#cloudSave').click();
  assert.equal(ui.rows.size, 1);
  const entry = [...ui.rows.values()][0];
  assert.deepEqual(entry.snapshot.rows, [[' hello ', ' 你好 ', '保留原列']]);
  assert.deepEqual(entry.snapshot.starred, [0]);
  assert.equal(
    JSON.stringify(entry.snapshot).includes('Private sentence draft'),
    false,
  );
  await ui.upload('word\nother', 'another.csv');
  assert.equal(ui.$('#cloudName').value, 'another.csv');
  await ui.$('#cloudLoad').click();
  assert.match(ui.$('#card').innerHTML, /hello/);
  assert.equal(ui.$('#cardStar').attrs['aria-pressed'], 'true');
  ui.$('#exportBtn').click();
  assert.equal(
    await ui.blobs[0].text(),
    'word,meaning,notes\r\n hello , 你好 ,保留原列',
  );
  await ui.$('#cloudSave').click();
  assert.equal(ui.rows.size, 1);
  await ui.upload('word\nnew', 'new.csv');
  await ui.$('#cloudSave').click();
  assert.equal(ui.rows.size, 2);
});

void test('云端读取期间本地修改不被覆盖，失败保存不清空当前练习', async () => {
  const ui = cloudUI();
  await ui.$('#cloudCreate').click();
  await ui.$('#cloudSave').click();
  const originalLoad = ui.api.load;
  let resolve;
  ui.api.load = async (id) => {
    await new Promise((done) => {
      resolve = done;
    });
    return originalLoad(id);
  };
  const pending = ui.$('#cloudLoad').click();
  await ui.upload('word\nlatest');
  resolve();
  await pending;
  assert.match(ui.$('#card').innerHTML, /latest/);
  assert.match(ui.$('#cloudStatus').textContent, /发生了变化/);
  ui.api.save = async () => {
    throw new Error('offline');
  };
  ui.$('#cardStar').click();
  await ui.$('#cloudSave').click();
  assert.match(ui.$('#card').innerHTML, /latest/);
  assert.equal(ui.$('#cardStar').attrs['aria-pressed'], 'true');
  assert.equal(ui.$('#cloudSave').disabled, false);
  assert.match(ui.$('#cloudStatus').textContent, /暂时无法/);
});

void test('取消云端切换和删除不会发请求，退出只移除设备同步码', async () => {
  const ui = cloudUI({ confirm: () => false });
  await ui.$('#cloudCreate').click();
  await ui.$('#cloudSave').click();
  await ui.$('#cloudLoad').click();
  await ui.$('#cloudDelete').click();
  assert.equal(ui.getLoads(), 0);
  assert.equal(ui.rows.size, 1);
  const other = cloudUI();
  await other.$('#cloudCreate').click();
  await other.$('#cloudSave').click();
  other.$('#cloudDisconnect').click();
  assert.equal(other.saved.size, 0);
  assert.equal(other.rows.size, 1);
  assert.equal(other.$('#cloudCode').value, '');
});

void test('浏览器不允许存储时仍可连接，并明确提示备份同步码', async () => {
  const denied = () => {
    throw new Error('denied');
  };
  const ui = cloudUI({
    storage: { getItem: denied, setItem: denied, removeItem: denied },
  });
  ui.$('#cloudCode').value = newSyncCode();
  await ui.$('#cloudConnect').click();
  assert.match(ui.$('#cloudStatus').textContent, /无法记住/);
  await ui.$('#cloudSave').click();
  assert.equal(ui.rows.size, 1);
});

void test('保存中导入新词表不会错绑旧云端副本', async () => {
  const ui = cloudUI();
  await ui.$('#cloudCreate').click();
  const originalSave = ui.api.save;
  let release;
  ui.api.save = async (...args) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return originalSave(...args);
  };
  const pending = ui.$('#cloudSave').click();
  await ui.upload('word\nnew-list', 'new-list.csv');
  release();
  await pending;
  assert.match(ui.$('#cloudStatus').textContent, /又有更改/);
  ui.api.save = originalSave;
  await ui.$('#cloudSave').click();
  assert.equal(ui.rows.size, 2);
});

void test('GitHub 页面 ID 唯一，反馈保持安全外链', () => {
  const { html } = createUI();
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.match(
    html,
    /href="https:\/\/forms\.gle\/j6agKyoEvyPoPSjP7"\s+target="_blank"\s+rel="noopener noreferrer"/,
  );
});

void test('手机默认收起词表，桌面默认展开，语言切换不重置用户选择', () => {
  const desktop = createUI();
  const mobile = createUI({ mobile: true });
  assert.equal(desktop.$('#libraryPanel').open, true);
  assert.equal(mobile.$('#libraryPanel').open, false);
  mobile.$('#libraryPanel').open = true;
  mobile.language('es');
  assert.equal(mobile.$('#libraryPanel').open, true);
  assert.equal(mobile.$('#libraryTitle').textContent, 'Lista y ajustes');
});

void test('翻面样式、星标和前后导航状态保持一致', () => {
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

void test('模式切换同步可访问状态，抽词只显示词和造句框', async () => {
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

void test('造句和星标经过三语切换仍保留，CSV 导出保留原始列', async () => {
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

void test('仅单词 CSV、可选字段取消和错误文件不会破坏页面', async () => {
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

void test('翻译变量中的美元符号和占位符按字面显示，不再次插值', () => {
  assert.equal(
    translate('en', 'sentencePlaceholder', { word: '$& $1 {word}' }),
    'Write a sentence with $& $1 {word}…',
  );
  assert.equal(translate('toString', 'field_word'), '单词');
  assert.equal(translate('en', 'constructor'), 'constructor');
});

void test('CSV 保留原始空格，学习内容单独清理', () => {
  const input = ' word ,meaning,extra\r\n" hello ","  space  ","first\nsecond"';
  const rows = parseCSV(input);
  assert.deepEqual(rows[1], [' hello ', '  space  ', 'first\nsecond']);
  assert.equal(
    createWords(rows.slice(1), detectMapping(rows[0]))[0].word,
    'hello',
  );
  assert.deepEqual(
    parseCSV(createStarredCSV(rows[0], rows.slice(1), [0])),
    rows,
  );
});

void test('CSV 严格拒绝单元格内部未转义引号及闭引号后的文字', () => {
  for (const csv of ['word\nhe"llo', 'word\n"hello"x', 'word\n"hello" ']) {
    assert.throws(() => parseCSV(csv), /errorMalformedCSV/);
  }
  assert.deepEqual(parseCSV('word,extra\n"a""b",'), [
    ['word', 'extra'],
    ['a"b', ''],
  ]);
  assert.deepEqual(parseCSV('\uFEFFword\rhello\r\r'), [['word'], ['hello']]);
  assert.deepEqual(parseCSV(' \n,\n'), []);
});

void test('解析时限制行列数，而不是等巨大数组生成后再检查', () => {
  assert.equal(
    parseCSV('word\n' + 'x\n'.repeat(MAX_CSV_ROWS)).length,
    MAX_CSV_ROWS + 1,
  );
  assert.throws(
    () => parseCSV('word\n' + 'x\n'.repeat(MAX_CSV_ROWS + 1)),
    /errorTooManyRows/,
  );
  assert.equal(
    parseCSV(Array(MAX_CSV_COLUMNS).fill('h').join(','))[0].length,
    MAX_CSV_COLUMNS,
  );
  assert.throws(
    () =>
      parseCSV(
        Array(MAX_CSV_COLUMNS + 1)
          .fill('h')
          .join(','),
      ),
    /errorTooManyColumns/,
  );
  assert.throws(() => parseCSV('x'.repeat(MAX_CSV_BYTES + 1)), /errorTooLarge/);
});

void test('字段识别优先完整列名，不把 password 误识别为 word', () => {
  assert.equal(detectMapping(['word example', 'word']).word, 1);
  assert.equal(detectMapping(['notes', 'password', 'vocabulary']).word, 2);
  assert.equal(detectMapping(['notes', 'password']).word, 0);
});

void test('抽词数量处理科学计数法、小数、非数值与非法总数', () => {
  assert.equal(clampCount('1e2', 200), 100);
  assert.equal(clampCount('3.9', 20), 3);
  assert.equal(clampCount('12oops', 20), 1);
  assert.equal(clampCount(Infinity, 20), 1);
  assert.equal(clampCount(2, NaN), 0);
  assert.equal(clampCount(5, 3.8), 3);
});

void test('CSV 引号、分隔符、多语言和空白数据的确定性往返测试', () => {
  const cells = [
    '你好',
    'mañana',
    'hello',
    'a,b',
    'a"b',
    ' a ',
    'x\r\ny',
    '$&',
    '',
    '\t',
  ];
  for (let n = 0; n < 100; n++) {
    const rows = [
      ['word', 'meaning', 'example'],
      ...Array.from({ length: 8 }, (_, i) => [
        'w' + n + '-' + i,
        cells[(n + i) % cells.length],
        cells[(n * 3 + i) % cells.length],
      ]),
    ];
    assert.deepEqual(parseCSV(serializeCSV(rows)), rows);
  }
});

void test('连续导入只采用最后一次选择，旧读取不能覆盖新词表', async () => {
  const { $, uploadFile, upload } = createUI();
  let finish;
  await uploadFile({
    name: 'slow.csv',
    size: 30,
    text: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  await upload('word\nnewest', 'latest.csv');
  finish('word\nold');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal($('#filename').textContent, '✓ latest.csv');
  assert.match($('#card').innerHTML, /newest/);
  assert.doesNotMatch($('#card').innerHTML, />old</);
});

void test('过时读取的错误不会污染新词表的状态提示', async () => {
  const { $, uploadFile, upload } = createUI();
  let fail;
  await uploadFile({
    name: 'slow.csv',
    size: 10,
    text: () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  });
  await upload('word\nlatest');
  fail(new Error('read failed'));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal($('#message').textContent, '');
  assert.match($('#card').innerHTML, /latest/);
});

void test('错误导入保留旧卡片、星标和已写例句', async () => {
  const { $, upload, document, blobs } = createUI();
  await upload('word,meaning\nhello,你好');
  $('#cardStar').click();
  const textarea = document.querySelectorAll('[data-answer]')[0];
  textarea.value = 'Keep my sentence.';
  textarea.listeners.input({ target: textarea });
  for (const invalid of [
    'word,meaning\n,只有释义',
    'word',
    'word\n"a"x',
    'word\nhello,extra',
  ]) {
    await upload(invalid);
    assert.equal($('#count').textContent, '1 个单词');
    assert.equal($('#cardStar').attrs['aria-pressed'], 'true');
    assert.equal(document.querySelectorAll('[data-answer]')[0], textarea);
    assert.equal(textarea.value, 'Keep my sentence.');
    assert.notEqual($('#message').textContent, '');
  }
  $('#exportBtn').click();
  assert.equal(await blobs[0].text(), 'word,meaning\r\nhello,你好');
});

void test('文件过大、读取失败、取消选择都有安全结果', async () => {
  const { $, uploadFile } = createUI();
  let read = false;
  await uploadFile({
    name: 'large.csv',
    size: MAX_CSV_BYTES + 1,
    text: async () => {
      read = true;
      return '';
    },
  });
  assert.equal(read, false);
  assert.match($('#message').textContent, /5 MB/);
  await uploadFile({
    name: 'bad.csv',
    size: 1,
    text: async () => {
      throw Error('denied');
    },
  });
  assert.match($('#message').textContent, /无法读取/);
  await uploadFile(undefined);
  assert.equal($('#count').textContent, '6 个单词');
  assert.match($('#message').textContent, /无法读取/);
});

void test('切换可选字段保留卡片顺序、页码、星标及当前造句节点', async () => {
  const { $, upload, document } = createUI();
  await upload('word,meaning\nhello,你好\nworld,世界');
  $('#next').click();
  $('#cardStar').click();
  const position = $('#position').textContent;
  const textarea = document.querySelectorAll('[data-answer]')[0];
  textarea.value = 'Do not clear this.';
  textarea.listeners.input({ target: textarea });
  const box = $('[data-include="meaning"]');
  box.checked = false;
  box.listeners.change({ target: box });
  assert.equal($('#position').textContent, position);
  assert.equal($('#cardStar').attrs['aria-pressed'], 'true');
  assert.equal(document.querySelectorAll('[data-answer]')[0], textarea);
  assert.equal(textarea.value, 'Do not clear this.');
  box.checked = true;
  box.listeners.change({ target: box });
  assert.equal(document.querySelectorAll('[data-answer]')[0], textarea);
});

void test('星标及模式切换不替换输入节点，保留焦点和选区', async () => {
  const { $, upload, document } = createUI();
  await upload('word\nhello');
  $('#drawTab').click();
  const textarea = document.querySelectorAll('[data-answer]')[0];
  textarea.value = 'Hello, world.';
  textarea.selectionStart = 3;
  textarea.selectionEnd = 5;
  textarea.listeners.input({ target: textarea });
  textarea.focus();
  document.querySelectorAll('[data-star]')[0].click();
  assert.equal(document.querySelectorAll('[data-answer]')[0], textarea);
  assert.equal(document.activeElement, textarea);
  assert.equal(textarea.selectionStart, 3);
  assert.equal(textarea.selectionEnd, 5);
  $('#cardsTab').click();
  $('#drawTab').click();
  assert.equal(document.querySelectorAll('[data-answer]')[0], textarea);
});

void test('大批抽词分页显示，跨页、星标、语言切换保留练习', async () => {
  const { $, upload, language, document } = createUI();
  await upload(
    'word\n' + Array.from({ length: 30 }, (_, i) => 'word' + i).join('\n'),
  );
  $('#drawCount').value = '30';
  $('#drawBtn').click();
  assert.equal(document.querySelectorAll('[data-answer]').length, 12);
  assert.equal($('#drawPagePosition').textContent, '第 1 / 3 页');
  assert.equal($('#drawPagePrev').disabled, true);
  const textarea = document.querySelectorAll('[data-answer]')[0];
  textarea.value = 'Remember this sentence.';
  textarea.listeners.input({ target: textarea });
  const index = textarea.dataset.answer;
  document.querySelectorAll('[data-star]')[0].click();
  $('#drawPageNext').click();
  $('#drawPageNext').click();
  assert.equal(document.querySelectorAll('[data-answer]').length, 6);
  assert.equal($('#drawPageNext').disabled, true);
  language('es');
  assert.equal($('#drawPagePosition').textContent, 'Página 3 de 3');
  $('#drawPagePrev').click();
  $('#drawPagePrev').click();
  assert.match($('#drawGrid').innerHTML, /Remember this sentence/);
  assert.equal($('[data-star="' + index + '"]').attrs['aria-pressed'], 'true');
  $('#drawCount').value = '1';
  $('#drawBtn').click();
  assert.equal($('#drawPagination').classList.contains('hide'), true);
  assert.equal(document.querySelectorAll('[data-answer]').length, 1);
});

void test('非法、重复及空单词列映射被拒绝，不清空旧词表', async () => {
  const { $, upload, document } = createUI();
  await upload('word,meaning,blank\nhello,你好,');
  const textarea = document.querySelectorAll('[data-answer]')[0];
  for (const value of ['', '-1', 'NaN', '100', '1', '2']) {
    const select = $('#map-word');
    select.value = value;
    select.listeners.change({ target: select });
    assert.equal($('#count').textContent, '1 个单词');
    assert.match($('#card').innerHTML, /hello/);
    assert.equal(document.querySelectorAll('[data-answer]')[0], textarea);
    assert.notEqual($('#message').textContent, '');
  }
});

void test('没有剩余列时启用附加字段不重置练习', async () => {
  const { $, upload, document } = createUI();
  await upload('word\nhello');
  const textarea = document.querySelectorAll('[data-answer]')[0];
  const checkbox = $('[data-include="meaning"]');
  checkbox.checked = true;
  checkbox.listeners.change({ target: checkbox });
  assert.equal(checkbox.checked, false);
  assert.equal(document.querySelectorAll('[data-answer]')[0], textarea);
  assert.match($('#message').textContent, /没有剩余/);
});

void test('重复表头显示列号，可导出原始同名列', async () => {
  const { $, upload, blobs } = createUI();
  await upload('word,word\nhello,hola');
  assert.match($('#mapping').innerHTML, /word \(第 1 列\)/);
  assert.match($('#mapping').innerHTML, /word \(第 2 列\)/);
  $('#cardStar').click();
  $('#exportBtn').click();
  assert.equal(await blobs[0].text(), 'word,word\r\nhello,hola');
});

void test('下载异常显示错误但保留星标，允许再次导出', () => {
  const { $ } = createUI({ downloadFailure: true });
  $('#cardStar').click();
  assert.doesNotThrow(() => $('#exportBtn').click());
  assert.match($('#message').textContent, /无法导出/);
  assert.equal($('#exportBtn').disabled, false);
});

void test('存储被禁用或语言偏好损坏时仍能使用三语界面', () => {
  for (const options of [
    { storageBlocked: true },
    { savedLocale: 'toString' },
    { savedLocale: 'xx' },
  ]) {
    const { $, language, document } = createUI(options);
    assert.equal(document.documentElement.lang, 'zh-CN');
    language('en');
    assert.equal(document.documentElement.lang, 'en');
    assert.equal($('#libraryTitle').textContent, 'Word list & settings');
  }
});

void test('示例词表初始化时也正确限制抽词数量', () => {
  const { $ } = createUI();
  assert.equal(Number($('#drawCount').max), 6);
  $('#drawCount').value = '-5';
  $('#drawBtn').click();
  assert.equal(Number($('#drawCount').value), 1);
  $('#drawCount').value = '10000';
  $('#drawBtn').click();
  assert.equal(Number($('#drawCount').value), 6);
});

void test('未识别的单词列可以跳过前面的空列或已识别释义列', async () => {
  const { $, upload } = createUI();
  await upload('unused,English\n,hello');
  assert.match($('#card').innerHTML, /hello/);
  await upload('meaning,English\n你好,world');
  assert.match($('#card').innerHTML, /world/);
  $('#flip').click();
  assert.match($('#card').innerHTML, /你好/);
});

void test('20,000 个词全部抽取时仍只生成 12 个输入框', async () => {
  const { $, upload, document } = createUI();
  await upload(
    'word\n' +
      Array.from({ length: MAX_CSV_ROWS }, (_, i) => 'w' + i).join('\n'),
  );
  assert.equal($('#count').textContent, '20000 个单词');
  $('#drawCount').value = String(MAX_CSV_ROWS);
  $('#drawBtn').click();
  assert.equal(Number($('#drawCount').value), MAX_CSV_ROWS);
  assert.equal(document.querySelectorAll('[data-answer]').length, 12);
  assert.equal($('#drawPagePosition').textContent, '第 1 / 1667 页');
});

void test('恶意单词、表头和例句只作为文字显示', async () => {
  const { $, upload, document } = createUI();
  const word = '<img src=x onerror="alert(1)"> $&';
  await upload(
    serializeCSV([
      ['word', '<script>alert(1)</script>'],
      [word, '</textarea><script>alert(1)</script>'],
    ]),
  );
  assert.match($('#mapping').innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch($('#mapping').innerHTML, /<script>/);
  assert.doesNotMatch($('#card').innerHTML, /<img/);
  assert.doesNotMatch($('#drawGrid').innerHTML, /<img|<script>/);
  const textarea = document.querySelectorAll('[data-answer]')[0];
  textarea.value = '</textarea><script>alert(1)</script>';
  textarea.listeners.input({ target: textarea });
  $('#languageSelect').value = 'en';
  $('#languageSelect').listeners.change({ target: $('#languageSelect') });
  assert.match($('#drawGrid').innerHTML, /&lt;\/textarea&gt;/);
  assert.doesNotMatch($('#drawGrid').innerHTML, /<script>/);
});
