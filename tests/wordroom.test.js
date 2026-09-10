import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { startCloud, CLOUD_TEXT } from '../wordroom-cloud.js';
import { startUI } from '../wordroom-ui.js';
import { startMusic } from '../wordroom-music.js';
import { newSyncCode, validateSnapshot } from '../cloud-data.js';
import {
  TRANSLATIONS,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  MAX_CSV_COLUMNS,
  MAX_CSV_SOURCES,
  MAX_IMPORT_BYTES,
  clampCount,
  createStarredCSV,
  createWords,
  combineSourceWords,
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
  const downloads = [];
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
    remove() {
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter(
          (child) => child !== this,
        );
        this.parentNode = null;
      }
    }
    appendChild(child) {
      return this.insertBefore(child, null);
    }
    insertBefore(child, reference) {
      child.remove();
      const index = this.children.indexOf(reference);
      if (index === -1) this.children.push(child);
      else this.children.splice(index, 0, child);
      child.parentNode = this;
      return child;
    }
    click() {
      if (this.tagName === 'A' && downloadFailure)
        throw new Error('Download blocked');
      if (this.tagName === 'A' && this.download) downloads.push(this.download);
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
    head: new Element('head', {}),
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
  const uploadFiles = async (files) => {
    $('#fileInput').listeners.change({
      target: { files },
    });
    await new Promise((resolve) => setImmediate(resolve));
  };
  const uploadFile = (file) => uploadFiles(file ? [file] : []);
  const upload = (text, name = 'test.csv') =>
    uploadFile({ name, size: Buffer.byteLength(text), text: async () => text });
  return {
    $,
    language,
    upload,
    uploadFile,
    uploadFiles,
    document,
    blobs,
    downloads,
    html,
    getMappingCalls: () => context.wordMappingCalls,
    studyApp: vm.runInContext('studyApp', context),
  };
}

const csvFile = (name, text) => ({
  name,
  size: Buffer.byteLength(text),
  text: async () => text,
});
const plain = (value) => JSON.parse(JSON.stringify(value));
const selectSource = (ui, index) => {
  const select = ui.$('#sourceSelect');
  select.value = String(index);
  select.listeners.change({ target: select });
};
const allDrawWords = (ui) => {
  ui.$('#drawCount').value = '20000';
  ui.$('#drawBtn').click();
  return [...ui.document.querySelectorAll('[data-answer]')];
};

function createThemeUI(options) {
  const ui = createUI(options);
  // The tiny DOM fixture is otherwise flat; model only the moving nav's parents.
  ui.$('#siteHeader').appendChild(ui.$('#practiceNav'));
  ui.$('#siteHeader').appendChild(ui.$('#editionMark'));
  ui.$('#sidebar').appendChild(ui.$('#libraryPanel'));
  startUI(ui.studyApp, ui.document);
  ui.switchUI = (theme) => {
    const select = ui.$('#uiSelect');
    select.value = theme;
    return select.listeners.change({ target: select });
  };
  return ui;
}

function attachMusic(ui, deviceVolume = false) {
  const audio = ui.$('#studyMusic');
  const calls = { play: 0, load: 0 };
  audio.paused = true;
  audio.currentTime = 0;
  audio.play = async () => {
    calls.play++;
    audio.paused = false;
    audio.listeners.playing();
  };
  audio.load = () => {
    calls.load++;
  };
  if (deviceVolume) {
    Object.defineProperty(audio, 'volume', { get: () => 1, set() {} });
  }
  startMusic(ui.studyApp, ui.document);
  return { audio, calls };
}

void test('BGM 使用第二版 AAC，默认关闭、按需加载、原生控制并循环', () => {
  const ui = createUI({ savedLocale: 'en' });
  const { audio, calls } = attachMusic(ui);
  assert.equal(audio.attrs.src, './audio/blue-hour-notes-v2.m4a');
  assert.equal(audio.attrs.preload, 'none');
  assert(Object.hasOwn(audio.attrs, 'controls'));
  assert(Object.hasOwn(audio.attrs, 'loop'));
  assert(!Object.hasOwn(audio.attrs, 'autoplay'));
  assert.equal(audio.volume, 0.35);
  assert.equal(audio.paused, true);
  assert.deepEqual(calls, { play: 0, load: 0 });
  assert.equal(ui.$('#musicTitle').textContent, 'Study music');
  assert.equal(ui.$('#musicError').hidden, true);
  const file = readFileSync(
    new URL('../audio/blue-hour-notes-v2.m4a', import.meta.url),
  );
  assert.equal(file.subarray(4, 8).toString(), 'ftyp');
  assert(file.length > 1_000_000 && file.length < 3_000_000);
});

void test('BGM 播放中切换 UI、语言和练习视图，不换音频节点或重置音量进度', async () => {
  const ui = createThemeUI();
  await ui.upload('word,meaning\nhello,你好');
  const { audio, calls } = attachMusic(ui);
  await audio.play();
  audio.currentTime = 37.25;
  audio.volume = 0.2;
  const changeId = ui.studyApp.getChangeId();
  const pending = ui.switchUI('p3r');
  ui.document.head.children[0].onload();
  await pending;
  ui.$('#drawTab').click();
  ui.language('es');
  assert.equal(ui.$('#musicTitle').textContent, 'Música de estudio');
  await ui.switchUI('classic');
  ui.$('#cardsTab').click();
  assert.equal(ui.$('#studyMusic'), audio);
  assert.equal(audio.currentTime, 37.25);
  assert.equal(audio.volume, 0.2);
  assert.equal(audio.paused, false);
  assert.deepEqual(calls, { play: 1, load: 0 });
  assert.equal(ui.studyApp.getChangeId(), changeId);
});

void test('BGM 网络失败可重试，播放被拒绝不产生未处理异常，主动暂停不报错', async () => {
  const ui = createUI();
  const { audio, calls } = attachMusic(ui);
  audio.listeners.error();
  assert.equal(ui.$('#musicError').hidden, false);
  ui.language('en');
  assert.match(ui.$('#musicStatus').textContent, /Check your connection/);
  const before = plain(ui.studyApp.capture());
  await ui.$('#musicRetry').click();
  assert.equal(ui.$('#musicError').hidden, true);
  assert.deepEqual(calls, { play: 1, load: 1 });
  audio.play = async () => {
    throw new Error('Playback rejected');
  };
  audio.listeners.error();
  await ui.$('#musicRetry').click();
  assert.equal(ui.$('#musicError').hidden, false);
  assert.equal(ui.$('#musicRetry').disabled, false);
  audio.play = async () => {
    throw Object.assign(new Error('Paused'), { name: 'AbortError' });
  };
  await ui.$('#musicRetry').click();
  assert.equal(ui.$('#musicError').hidden, true);
  assert.deepEqual(plain(ui.studyApp.capture()), before);
});

void test('设备接管音量时提示使用音量键，禁用本地存储不影响播放器', () => {
  const ui = createUI({ mobile: true, storageBlocked: true });
  const { audio, calls } = attachMusic(ui, true);
  assert.equal(audio.volume, 1);
  assert.equal(ui.$('#musicVolumeHint').hidden, false);
  assert.match(ui.$('#musicVolumeHint').textContent, /音量键/);
  ui.language('es');
  assert.match(
    ui.$('#musicVolumeHint').textContent,
    /botones de tu dispositivo/,
  );
  assert.deepEqual(calls, { play: 0, load: 0 });
});

void test('界面默认经典版，不预加载 P3R，保留手机折叠状态和语言', () => {
  for (const [locale, label] of [
    ['zh', '经典 UI'],
    ['en', 'Classic UI'],
    ['es', 'UI clásica'],
  ]) {
    const ui = createThemeUI({ mobile: true, savedLocale: locale });
    assert.equal(ui.document.body.dataset.ui, 'classic');
    assert.equal(ui.$('#classicTheme').media, 'all');
    assert.equal(ui.$('#uiSelect').value, 'classic');
    assert.equal(ui.$('#classicUIOption').textContent, label);
    assert.equal(ui.$('#practiceNav').parentNode, ui.$('#siteHeader'));
    assert.equal(ui.$('#libraryPanel').open, false);
    assert.equal(ui.document.head.children.length, 0);
    assert.equal(ui.$('#uiStatus').hidden, true);
    assert.match(ui.html.split('</header>')[0], /id="practiceNav"/);
  }
  const blocked = createThemeUI({ storageBlocked: true });
  assert.equal(blocked.$('#uiSelect').value, 'classic');
  assert.equal(blocked.$('#libraryPanel').open, true);
});

void test('反复切换 UI 保留多词表、翻面、星标、抽词、造句节点和导航监听器', async () => {
  const ui = createThemeUI();
  await ui.uploadFiles([
    csvFile('a.csv', 'word,meaning\nhello,你好\nworld,世界'),
    csvFile('b.csv', 'palabra,ejemplo\nhola,Hola.'),
  ]);
  ui.$('#next').click();
  ui.$('#flip').click();
  ui.$('#cardStar').click();
  ui.$('#drawTab').click();
  ui.$('#libraryPanel').open = false;
  const textarea = ui.document.querySelectorAll('[data-answer]')[0];
  textarea.value = 'Keep this sentence.';
  textarea.selectionStart = 2;
  textarea.selectionEnd = 5;
  textarea.listeners.input({ target: textarea });
  const snapshot = plain(ui.studyApp.capture());
  const changeId = ui.studyApp.getChangeId();
  const position = ui.$('#position').textContent;
  const drawMarkup = ui.$('#drawGrid').innerHTML;
  const mappings = ui.getMappingCalls();
  const nav = ui.$('#practiceNav');

  const pending = ui.switchUI('p3r');
  assert.equal(ui.$('#uiSelect').disabled, true);
  assert.equal(ui.document.body.dataset.ui, 'classic');
  assert.equal(nav.parentNode, ui.$('#siteHeader'));
  const sheet = ui.document.head.children[0];
  assert.equal(sheet.media, 'not all');
  assert.match(sheet.href, /wordroom-p3r\.css\?v=2$/);
  sheet.onload();
  await pending;

  for (const theme of ['p3r', 'classic', 'p3r', 'classic']) {
    await ui.switchUI(theme);
    const preview = theme === 'p3r';
    assert.equal(ui.document.body.dataset.ui, theme);
    assert.equal(ui.$('#classicTheme').media, preview ? 'not all' : 'all');
    assert.equal(sheet.media, preview ? 'all' : 'not all');
    assert.equal(nav.parentNode, ui.$(preview ? '#sidebar' : '#siteHeader'));
    assert.equal(ui.$('#practiceNav'), nav);
    assert.equal(ui.$('#uiSelect').disabled, false);
    assert.equal(ui.$('#libraryPanel').open, false);
    assert.equal(ui.$('#position').textContent, position);
    assert.equal(ui.$('#card').classList.contains('is-flipped'), true);
    assert.equal(ui.$('#drawGrid').innerHTML, drawMarkup);
    assert.equal(ui.$('#drawView').classList.contains('hide'), false);
    assert.equal(ui.document.querySelectorAll('[data-answer]')[0], textarea);
    assert.equal(textarea.value, 'Keep this sentence.');
    assert.equal(textarea.selectionStart, 2);
    assert.equal(textarea.selectionEnd, 5);
    assert.equal(ui.studyApp.getChangeId(), changeId);
    assert.deepEqual(plain(ui.studyApp.capture()), snapshot);
    assert.equal(ui.getMappingCalls(), mappings);
    assert.equal(ui.document.head.children.length, 1);
    assert.equal(
      ui.document.querySelector('meta[name="theme-color"]').attrs.content,
      preview ? '#0758ee' : '#243550',
    );
  }
  ui.$('#cardsTab').click();
  assert.equal(ui.$('#cardsView').classList.contains('hide'), false);
  ui.$('#next').click();
  assert.notEqual(ui.$('#position').textContent, position);
  assert.equal(createThemeUI().$('#uiSelect').value, 'classic');
});

void test('预览 CSS 加载失败保留经典 UI，可重试；提示跟随语言切换', async () => {
  const ui = createThemeUI({ savedLocale: 'en' });
  const pending = ui.switchUI('p3r');
  assert.equal(ui.$('#uiStatus').textContent, 'Loading preview…');
  ui.language('es');
  assert.equal(ui.$('#uiStatus').textContent, 'Cargando vista previa…');
  ui.document.head.children[0].onerror();
  await pending;
  assert.equal(ui.document.head.children.length, 0);
  assert.equal(ui.$('#uiSelect').disabled, false);
  assert.equal(ui.$('#uiSelect').value, 'classic');
  assert.equal(ui.$('#classicTheme').media, 'all');
  assert.equal(ui.$('#practiceNav').parentNode, ui.$('#siteHeader'));
  assert.equal(ui.$('#uiStatus').hidden, false);
  assert.match(ui.$('#uiStatus').textContent, /Inténtalo de nuevo/);

  const retry = ui.switchUI('p3r');
  ui.document.head.children[0].onload();
  await retry;
  assert.equal(ui.document.body.dataset.ui, 'p3r');
  assert.equal(ui.$('#uiStatus').hidden, true);
  ui.language('zh');
  assert.equal(ui.$('#uiLabel').textContent, '界面风格');
  assert.equal(ui.$('#previewUIOption').textContent, 'P3R 预览');
  assert.equal(ui.$('#uiSelect').value, 'p3r');
  await ui.switchUI('unknown');
  assert.equal(ui.$('#uiSelect').value, 'p3r');
  assert.equal(ui.document.body.dataset.ui, 'p3r');
});

void test('多选 CSV 按各自映射合并；重复单词与空词行保留独立来源', async () => {
  const ui = createUI();
  assert.match(ui.html, /id="fileInput"[^>]*\bmultiple\b/);
  await ui.uploadFiles([
    csvFile('a.csv', 'word,meaning\n shared , 第一义 \n,skip'),
    csvFile(
      'b.csv',
      'ejemplo,palabra,notes\nAn example.,shared,keep\nOtro.,hola,raw',
    ),
  ]);
  assert.equal(ui.$('#count').textContent, '3 个单词');
  assert.equal(ui.$('#sourceSettings').classList.contains('hide'), false);
  const snapshot = plain(ui.studyApp.capture());
  assert.equal(snapshot.schemaVersion, 2);
  assert.deepEqual(
    snapshot.sources.map((source) => source.name),
    ['a.csv', 'b.csv'],
  );
  assert.deepEqual(
    combineSourceWords(snapshot.sources).map((word) => [
      word.sourceIndex,
      word.word,
      word.meaning,
      word.example,
    ]),
    [
      [0, 'shared', '第一义', ''],
      [2, 'shared', '', 'An example.'],
      [3, 'hola', '', 'Otro.'],
    ],
  );
  assert.equal(allDrawWords(ui).length, 3);
  assert.match(ui.$('#position').textContent, /\/ 3$/);
  assert.equal(ui.getMappingCalls(), 2);
});

void test('追加保留旧星标和当前造句，新词可参与洗牌与重新抽词', async () => {
  const ui = createUI();
  await ui.upload('word,meaning\none,一\n,跳过', 'first.csv');
  ui.$('#cardStar').click();
  const draft = ui.$('[data-answer="0"]');
  draft.value = 'One sentence.';
  draft.listeners.input();
  ui.$('#importMode').value = 'append';
  await ui.uploadFiles([
    csvFile('second.csv', 'palabra,ejemplo\ndos,Two.'),
    csvFile('third.csv', 'word\nthree'),
  ]);
  assert.equal(ui.$('#count').textContent, '3 个单词');
  assert.match(ui.$('#drawGrid').innerHTML, /One sentence\./);
  assert.deepEqual(plain(ui.studyApp.capture().starred), [0]);
  assert.equal(ui.$('#sourceSelect').value, '1');
  assert.deepEqual(
    allDrawWords(ui)
      .map((field) => Number(field.dataset.answer))
      .sort((a, b) => a - b),
    [0, 2, 3],
  );
});

void test('追加模式首次导入不混入示例；替换模式清除上一批词表和星标', async () => {
  const ui = createUI();
  ui.$('#importMode').value = 'append';
  await ui.upload('word\none');
  assert.equal(ui.$('#count').textContent, '1 个单词');
  ui.$('#cardStar').click();
  ui.$('#importMode').value = 'replace';
  await ui.uploadFiles([
    csvFile('a.csv', 'word\na'),
    csvFile('b.csv', 'word\nb'),
  ]);
  assert.equal(ui.$('#count').textContent, '2 个单词');
  assert.deepEqual(plain(ui.studyApp.capture().starred), []);
});

void test('多 CSV 单独设置可选字段，不影响另一文件的卡片答案', async () => {
  const ui = createUI();
  await ui.uploadFiles([
    csvFile('a.csv', 'word,meaning\na,first'),
    csvFile('b.csv', 'word,example\nb,second'),
  ]);
  selectSource(ui, 1);
  assert.equal(ui.document.querySelector('#map-meaning'), null);
  assert(ui.document.querySelector('#map-example'));
  const checkbox = ui.$('[data-include="example"]');
  checkbox.checked = false;
  checkbox.listeners.change();
  selectSource(ui, 0);
  assert(ui.document.querySelector('#map-meaning'));
  const checked = validateSnapshot(plain(ui.studyApp.capture()));
  assert.equal(checked.words[0].meaning, 'first');
  assert.equal(checked.words[1].example, '');
  // The settings selector must not be used to decide which fields a card has.
  selectSource(ui, 1);
  for (let i = 0; i < 2; i++) {
    ui.$('#flip').click();
    if (ui.$('#card').innerHTML.includes('>a</span>'))
      assert.match(ui.$('#card').innerHTML, /first/);
    else assert.doesNotMatch(ui.$('#card').innerHTML, /second/);
    ui.$('#next').click();
  }
});

void test('更换一份 CSV 的单词列，不移动其他文件星标与原始行号', async () => {
  const ui = createUI();
  await ui.uploadFiles([
    csvFile('a.csv', 'word,alternate\na,new\n,extra'),
    csvFile('b.csv', 'word\nb'),
  ]);
  allDrawWords(ui);
  ui.document
    .querySelectorAll('[data-star]')
    .forEach((button) => button.click());
  const select = ui.$('#map-word');
  select.value = '1';
  select.listeners.change({ target: select });
  assert.equal(ui.$('#count').textContent, '3 个单词');
  assert.deepEqual(plain(ui.studyApp.capture().starred), [2]);
});

void test('任一 CSV 无效时整批取消，追加和替换都保留原始练习', async () => {
  for (const mode of ['replace', 'append']) {
    const ui = createUI();
    await ui.upload('word\nold');
    ui.$('#cardStar').click();
    const draft = ui.$('[data-answer="0"]');
    draft.value = 'Do not lose this.';
    draft.listeners.input();
    const before = plain(ui.studyApp.capture());
    ui.$('#importMode').value = mode;
    await ui.uploadFiles([
      csvFile('good.csv', 'word\ngood'),
      csvFile('bad.csv', 'word\n"broken'),
    ]);
    assert.deepEqual(plain(ui.studyApp.capture()), before);
    assert.match(ui.$('#message').textContent, /bad.csv/);
    assert.equal(ui.$('[data-answer="0"]'), draft);
    assert.equal(draft.value, 'Do not lose this.');
    ui.language('es');
    assert.match(ui.$('#message').textContent, /bad.csv:.*sin cerrar/);
  }
});

void test('拖放处理整批文件，多个相同文件名不会互相覆盖', async () => {
  const ui = createUI();
  ui.$('#drop').listeners.drop({
    preventDefault() {},
    dataTransfer: {
      files: [csvFile('same.csv', 'word\na'), csvFile('same.csv', 'word\nb')],
    },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.$('#count').textContent, '2 个单词');
  assert.equal(ui.studyApp.capture().sources.length, 2);
});

void test('多文件星标分别导出原始 CSV，包含重复表头、原始空格和未映射列', async () => {
  const ui = createUI();
  await ui.uploadFiles([
    csvFile('same.csv', 'word,notes,notes\n first ,"a,b", second \n,skip,no'),
    csvFile('same.csv', 'ejemplo,palabra,other\n"a\nb",second,"""quoted"""'),
  ]);
  allDrawWords(ui);
  ui.document
    .querySelectorAll('[data-star]')
    .forEach((button) => button.click());
  ui.$('#exportBtn').click();
  assert.equal(ui.$('#exportSources').classList.contains('hide'), false);
  ui.$('[data-export-source="0"]').click();
  ui.$('[data-export-source="1"]').click();
  assert.equal(ui.blobs.length, 2);
  assert.deepEqual(parseCSV(await ui.blobs[0].text()), [
    ['word', 'notes', 'notes'],
    [' first ', 'a,b', ' second '],
  ]);
  assert.deepEqual(parseCSV(await ui.blobs[1].text()), [
    ['ejemplo', 'palabra', 'other'],
    ['a\nb', 'second', '"quoted"'],
  ]);
  assert.equal(ui.downloads.length, 2);
  assert.notEqual(ui.downloads[0], ui.downloads[1]);
  ui.$('#exportBtn').click();
  assert.equal(ui.$('#exportSources').classList.contains('hide'), true);
});

void test('合并词库限制总行数、总大小与文件数；超限不部分导入', async () => {
  const ui = createUI();
  const before = plain(ui.studyApp.capture());
  await ui.uploadFiles(
    Array.from({ length: MAX_CSV_SOURCES + 1 }, () =>
      csvFile('a.csv', 'word\na'),
    ),
  );
  assert.match(ui.$('#message').textContent, /20 份/);
  assert.deepEqual(plain(ui.studyApp.capture()), before);
  await ui.uploadFiles(
    Array.from({ length: 3 }, () => ({
      name: 'big.csv',
      size: MAX_IMPORT_BYTES / 2,
      text: async () => {
        throw new Error('must not read');
      },
    })),
  );
  assert.match(ui.$('#message').textContent, /10 MB/);
  await ui.uploadFiles([
    csvFile('full.csv', 'word\n' + 'a\n'.repeat(MAX_CSV_ROWS)),
    csvFile('extra.csv', 'word\nextra'),
  ]);
  assert.match(ui.$('#message').textContent, /20,000/);
  assert.deepEqual(plain(ui.studyApp.capture()), before);
});

void test('较旧的多文件读取不会覆盖新导入；读取中切换模式不改变原选择', async () => {
  const ui = createUI();
  await ui.upload('word\nbase');
  ui.$('#importMode').value = 'append';
  let finish;
  await ui.uploadFiles([
    {
      name: 'slow.csv',
      size: 10,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ]);
  ui.$('#importMode').value = 'replace';
  finish('word\nappend');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.$('#count').textContent, '2 个单词');
  await ui.uploadFiles([
    csvFile('fast.csv', 'word\nfast'),
    {
      name: 'slow.csv',
      size: 10,
      text: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
  ]);
  await ui.upload('word\nnewest');
  finish('word\nold');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.$('#count').textContent, '1 个单词');
  assert.match(ui.$('#card').innerHTML, /newest/);
});

void test('恶意文件名安全显示，三语切换和非法来源选择不改变词库', async () => {
  const ui = createUI();
  await ui.uploadFiles([
    csvFile('<img src=x onerror=alert(1)>.csv', 'word\na'),
    csvFile('b.csv', 'word\nb'),
  ]);
  assert.doesNotMatch(ui.$('#sourceSelect').innerHTML, /<img/);
  const before = plain(ui.studyApp.capture());
  selectSource(ui, 99);
  assert.equal(ui.$('#sourceSelect').value, '0');
  ui.language('en');
  assert.equal(ui.$('#appendLists').textContent, 'Append lists');
  ui.language('es');
  assert.equal(ui.$('#appendLists').textContent, 'Añadir listas');
  assert.deepEqual(plain(ui.studyApp.capture()), before);
});

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
        wordCount: validateSnapshot(snapshot).words.length,
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

void test('合并词库云端保存恢复独立映射、原始行和星标；旧词库仍可打开', async () => {
  const ui = cloudUI();
  await ui.uploadFiles([
    csvFile('a.csv', 'word,meaning,notes\na, 一 ,raw\n,skip,no'),
    csvFile('b.csv', 'ejemplo,palabra\nExample.,b'),
  ]);
  allDrawWords(ui);
  ui.$('[data-star="2"]').click();
  const before = plain(ui.studyApp.capture());
  await ui.$('#cloudCreate').click();
  await ui.$('#cloudSave').click();
  const entry = [...ui.rows.values()][0];
  assert.equal(entry.wordCount, 2);
  assert.deepEqual(entry.snapshot, before);
  await ui.upload('word\nlocal');
  ui.$('#cloudSelect').value = entry.id;
  await ui.$('#cloudLoad').click();
  assert.deepEqual(plain(ui.studyApp.capture()), before);
  assert.equal(ui.$('#count').textContent, '2 个单词');
  assert.equal(ui.$('#exportBtn').textContent, '导出星标（1）');
  selectSource(ui, 1);
  assert(ui.document.querySelector('#map-example'));
  assert.equal(ui.document.querySelector('#map-meaning'), null);
  const checkbox = ui.$('[data-include="example"]');
  checkbox.checked = false;
  checkbox.listeners.change();
  await ui.$('#cloudSave').click();
  assert.equal(ui.rows.size, 1);
  assert.equal(ui.rows.get(entry.id).snapshot.sources[1].mapping.example, null);
  // Restoring a v1 snapshot after a multi-file snapshot clears all extra sources.
  const legacy = {
    schemaVersion: 1,
    name: 'legacy.csv',
    headers: ['word'],
    rows: [['legacy']],
    mapping: { word: 0, meaning: null, example: null, phrase: null },
    starred: [0],
  };
  ui.studyApp.restore(validateSnapshot(legacy));
  assert.deepEqual(plain(ui.studyApp.capture()), legacy);
  assert.equal(ui.$('#sourceSettings').classList.contains('hide'), true);
});

void test('从云端打开后追加另一个 CSV，另存新词库而不覆盖原副本', async () => {
  const ui = cloudUI();
  await ui.upload('word\nfirst');
  await ui.$('#cloudCreate').click();
  await ui.$('#cloudSave').click();
  const original = [...ui.rows.values()][0];
  ui.$('#importMode').value = 'append';
  await ui.upload('word\nsecond');
  await ui.$('#cloudSave').click();
  assert.equal(ui.rows.size, 2);
  assert.equal(ui.rows.get(original.id).snapshot.schemaVersion, 1);
  assert.equal(
    [...ui.rows.values()].find((entry) => entry.id !== original.id).snapshot
      .sources.length,
    2,
  );
});

void test('CSV 读取完成也标记本地变动，阻止进行中的云端打开覆盖新词库', async () => {
  const ui = cloudUI();
  await ui.$('#cloudCreate').click();
  await ui.$('#cloudSave').click();
  ui.$('#cloudSelect').value = [...ui.rows.keys()][0];
  let finishCSV, finishCloud;
  await ui.uploadFile({
    name: 'slow.csv',
    size: 10,
    text: () =>
      new Promise((resolve) => {
        finishCSV = resolve;
      }),
  });
  const load = ui.api.load;
  ui.api.load = (id) =>
    new Promise((resolve) => {
      finishCloud = async () => resolve(await load(id));
    });
  const pending = ui.$('#cloudLoad').click();
  finishCSV('word\nnew');
  await new Promise((resolve) => setImmediate(resolve));
  await finishCloud();
  await pending;
  assert.equal(ui.$('#count').textContent, '1 个单词');
  assert.match(ui.$('#card').innerHTML, />new</);
});

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
