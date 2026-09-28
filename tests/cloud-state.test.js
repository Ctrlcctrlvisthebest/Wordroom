import test from 'node:test';
import assert from 'node:assert/strict';
import { startCloud, CLOUD_TEXT } from '../wordroom-cloud.js';
import { newSyncCode, validateSnapshot } from '../cloud-data.js';

const sample = () => ({
  schemaVersion: 1,
  name: 'practice.csv',
  headers: ['word', 'meaning'],
  rows: [
    ['one', '一'],
    ['two', '二'],
  ],
  mapping: {
    word: 0,
    meaning: 1,
    example: null,
    phrase: null,
    association: null,
  },
  starred: [],
});

function backend() {
  const rows = new Map(),
    writes = [],
    reads = [];
  const api = {
    list: async () =>
      [...rows.values()].map(({ snapshot: _snapshot, ...entry }) => entry),
    save: async (id, snapshot, revision) => {
      writes.push({ id, revision, snapshot: structuredClone(snapshot) });
      const before = rows.get(id);
      if ((before?.revision || null) !== revision) throw new Error('conflict');
      const entry = {
        id,
        revision: crypto.randomUUID(),
        name: snapshot.name,
        wordCount: 2,
        updatedAt: Date.now(),
      };
      rows.set(id, { ...entry, snapshot: structuredClone(snapshot) });
      return entry;
    },
    load: async (id) => {
      reads.push(id);
      const row = rows.get(id);
      if (!row) throw new Error('notFound');
      const { snapshot, ...entry } = row;
      return { entry, validated: validateSnapshot(snapshot) };
    },
    delete: async (entry) => rows.delete(entry.id),
  };
  return { api, rows, writes, reads };
}

function harness({
  remote = backend(),
  saved = new Map(),
  snapshot = sample(),
  storage: customStorage,
} = {}) {
  const nodes = new Map();
  const ids = [
    'cloudStatus',
    'cloudSaveState',
    'cloudCode',
    'cloudConnectActions',
    'cloudSessionActions',
    'cloudLibrary',
    'cloudSelect',
    'cloudConnect',
    'cloudCreate',
    'cloudCopy',
    'cloudDisconnect',
    'cloudSave',
    'cloudRefresh',
    'cloudLoad',
    'cloudDelete',
    'cloudName',
    'languageSelect',
    'cloudPanel',
  ];
  for (const id of ids) {
    const node = {
      value: '',
      textContent: '',
      dataset: {},
      disabled: false,
      readOnly: false,
      classList: { toggle() {} },
      listeners: {},
      addEventListener(event, listener) {
        this.listeners[event] = listener;
      },
      click() {
        return this.disabled ? undefined : this.listeners.click?.();
      },
      focus() {},
      select() {},
    };
    nodes.set('#' + id, node);
  }
  let contentId = 0,
    changeId = 0,
    importId = 0,
    captures = 0,
    locale = 'zh';
  const changes = new Set(),
    imports = new Set();
  const notify = (cloud) => {
    changeId++;
    if (cloud) contentId++;
    changes.forEach((listener) => listener({ cloud }));
  };
  const app = {
    getLocale: () => locale,
    getChangeId: () => changeId,
    getContentChangeId: () => contentId,
    getImportId: () => importId,
    capture: () => {
      captures++;
      return structuredClone(snapshot);
    },
    onChange: (listener) => changes.add(listener),
    onImport: (listener) => imports.add(listener),
    restore: ({ snapshot: value }) => {
      snapshot = structuredClone(value);
      importId++;
      notify(true);
      imports.forEach((listener) => listener());
    },
  };
  const storage = customStorage || {
    getItem: (key) => saved.get(key),
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };
  const document = {
    querySelector: (selector) => nodes.get(selector),
    querySelectorAll: () => [],
  };
  startCloud(app, {
    document,
    storage,
    client: () => remote.api,
    confirm: () => true,
  });
  const $ = (id) => nodes.get('#' + id);
  return {
    $,
    app,
    saved,
    remote,
    getCaptures: () => captures,
    getSnapshot: () => structuredClone(snapshot),
    change: (mutate) => {
      mutate(snapshot);
      notify(true);
    },
    practice: () => notify(false),
    language: (next) => {
      locale = next;
      $('languageSelect').listeners.change();
    },
    import: (next) => app.restore(validateSnapshot(next)),
    rename: (name) => {
      $('cloudName').value = name;
      $('cloudName').listeners.input();
    },
  };
}

async function settled(ui) {
  for (let i = 0; i < 1000; i++) {
    if (!ui.$('cloudSave').disabled) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail('Cloud action did not settle');
}

void test('连接不等于保存；星标/名称变动标为未保存，草稿和导航不重复捕获词表', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  assert.equal(ui.$('cloudSaveState').dataset.state, 'unsaved');
  assert.equal(ui.remote.writes.length, 0);
  await ui.$('cloudSave').click();
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
  assert.match(ui.$('cloudSaveState').textContent, /最近确认的云端保存/);
  const count = ui.getCaptures();
  for (let i = 0; i < 100; i++) ui.practice();
  assert.equal(ui.getCaptures(), count);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
  ui.change((snapshot) => snapshot.starred.push(0));
  assert.equal(ui.$('cloudSaveState').dataset.state, 'dirty');
  await ui.$('cloudSave').click();
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
  ui.rename('renamed');
  assert.equal(ui.$('cloudSaveState').dataset.state, 'dirty');
  ui.rename('practice.csv');
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
  ui.import({ ...sample(), name: 'other.csv' });
  assert.equal(ui.$('cloudSaveState').dataset.state, 'unsaved');
});

void test('请求超时但写入已成功：只读核对成功，不重复 PUT 或创建副本', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save;
  ui.remote.api.save = async (...args) => {
    await save(...args);
    throw new Error('timeout');
  };
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes.length, 1);
  assert.equal(ui.remote.rows.size, 1);
  assert.equal(ui.remote.reads.length, 1);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
  assert.equal(ui.$('cloudStatus').textContent, CLOUD_TEXT.zh.saved);
  assert.equal(
    ui.saved.size,
    1,
    'only the existing sync-code preference remains',
  );
  ui.remote.api.save = save;
  ui.change((snapshot) => snapshot.starred.push(0));
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.rows.size, 1);
  assert.equal(ui.remote.writes[1].id, ui.remote.writes[0].id);
  assert(ui.remote.writes[1].revision);
});

void test('首次超时未写入：不自动重试，手动保存沿用相同 ID 和条件头', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save;
  const attempted = [];
  ui.remote.api.save = async (id, _snapshot, revision) => {
    attempted.push({ id, revision });
    throw new Error('timeout');
  };
  await ui.$('cloudSave').click();
  assert.equal(attempted.length, 1);
  assert.equal(ui.remote.rows.size, 0);
  assert.match(ui.$('cloudStatus').textContent, /沿用同一副本编号/);
  const pending = [...ui.saved.entries()].find(([key]) =>
    key.startsWith('wordroom-cloud-pending'),
  );
  assert(pending);
  assert.deepEqual(Object.keys(JSON.parse(pending[1])).sort(), [
    'digest',
    'id',
    'revision',
  ]);
  assert(!pending[1].includes('practice.csv'));
  assert(!pending[1].includes(ui.$('cloudCode').value));
  ui.remote.api.save = save;
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes[0].id, attempted[0].id);
  assert.equal(ui.remote.writes[0].revision, null);
  assert.equal(ui.remote.rows.size, 1);
});

void test('读取也失败时再次保存只核对，不写入；恢复网络后确认旧快照仍提示新变动', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save,
    load = ui.remote.api.load;
  ui.remote.api.save = async (...args) => {
    await save(...args);
    throw new Error('networkError');
  };
  ui.remote.api.load = async () => {
    throw new Error('networkError');
  };
  await ui.$('cloudSave').click();
  assert.equal(ui.$('cloudSaveState').dataset.state, 'pendingSave');
  ui.change((snapshot) => snapshot.starred.push(1));
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes.length, 1);
  ui.remote.api.load = load;
  await ui.$('cloudRefresh').click();
  assert.equal(ui.remote.writes.length, 1);
  assert.equal(ui.$('cloudStatus').textContent, CLOUD_TEXT.zh.savedEarlier);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'dirty');
  ui.remote.api.save = save;
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.rows.size, 1);
  assert.deepEqual([...ui.remote.rows.values()][0].snapshot.starred, [1]);
});

void test('核对遇到其他设备的新版本时不覆盖，也不改用新 ID；明确打开云端才解除冲突', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save;
  ui.remote.api.save = async (...args) => {
    const entry = await save(...args);
    const other = structuredClone(args[1]);
    other.starred = [1];
    await save(entry.id, other, entry.revision);
    throw new Error('timeout');
  };
  await ui.$('cloudSave').click();
  assert.match(ui.$('cloudStatus').textContent, /不会覆盖较新的版本/);
  const writes = ui.remote.writes.length;
  ui.remote.api.save = save;
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes.length, writes);
  await ui.$('cloudRefresh').click();
  await ui.$('cloudLoad').click();
  assert.deepEqual(ui.getSnapshot().starred, [1]);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
});

void test('刷新页面后恢复待核对 ID，只检查已保存结果，不自动上传或新增副本', async () => {
  const first = harness();
  await first.$('cloudCreate').click();
  const save = first.remote.api.save,
    load = first.remote.api.load;
  first.remote.api.save = async (...args) => {
    await save(...args);
    throw new Error('timeout');
  };
  first.remote.api.load = async () => {
    throw new Error('networkError');
  };
  await first.$('cloudSave').click();
  assert.equal(first.saved.size, 2);
  first.remote.api.load = load;
  first.remote.api.save = save;
  const reloaded = harness({ remote: first.remote, saved: first.saved });
  await settled(reloaded);
  assert.equal(reloaded.$('cloudSaveState').dataset.state, 'clean');
  assert.equal(first.remote.writes.length, 1);
  reloaded.change((snapshot) => snapshot.starred.push(0));
  await reloaded.$('cloudSave').click();
  assert.equal(first.remote.rows.size, 1);
  assert.equal(first.remote.writes[0].id, first.remote.writes[1].id);
});

void test('刷新后服务器仍未写入，用户手动重试也沿用持久化 ID', async () => {
  const first = harness();
  await first.$('cloudCreate').click();
  const save = first.remote.api.save;
  let attempted;
  first.remote.api.save = async (id) => {
    attempted = id;
    throw new Error('timeout');
  };
  await first.$('cloudSave').click();
  first.remote.api.save = save;
  const reloaded = harness({ remote: first.remote, saved: first.saved });
  await settled(reloaded);
  assert.equal(first.remote.writes.length, 0);
  await reloaded.$('cloudSave').click();
  assert.equal(first.remote.writes[0].id, attempted);
});

void test('不确定保存后的手动重试即使遇到配额错误，也不能丢失原来的副本 ID', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save;
  const attempts = [];
  ui.remote.api.save = async (id) => {
    attempts.push(id);
    throw new Error(attempts.length === 1 ? 'timeout' : 'quotaExceeded');
  };
  await ui.$('cloudSave').click();
  await ui.$('cloudSave').click();
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0], attempts[1]);
  assert.match(ui.$('cloudStatus').textContent, /40 MB/);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'pendingSave');
  ui.remote.api.save = save;
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes[0].id, attempts[0]);
});

void test('更新超时且读取到旧版本时，重试仍使用原条件版本；读取后出现新版本也不覆盖', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  await ui.$('cloudSave').click();
  const original = structuredClone([...ui.remote.rows.values()][0]);
  const save = ui.remote.api.save;
  ui.change((snapshot) => snapshot.starred.push(0));
  ui.remote.api.save = async () => {
    throw new Error('timeout');
  };
  await ui.$('cloudSave').click();
  assert.match(ui.$('cloudStatus').textContent, /沿用同一副本编号/);
  ui.remote.api.save = async (id, snapshot, revision) => {
    // Another device commits after our readback but before our conditional PUT.
    await save(id, { ...original.snapshot, starred: [1] }, original.revision);
    return save(id, snapshot, revision);
  };
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.rows.size, 1);
  assert.deepEqual([...ui.remote.rows.values()][0].snapshot.starred, [1]);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'conflict');
  assert.match(ui.$('cloudStatus').textContent, /不会覆盖较新的版本/);
});

void test('待核对元数据按同步码隔离；无效记录不能成为保存目标', async () => {
  const saved = new Map([
    ['wordroom-cloud-code-v1', newSyncCode()],
    [
      'wordroom-cloud-pending-v1:other',
      JSON.stringify({ id: 'bad', revision: null, digest: 'x' }),
    ],
  ]);
  const ui = harness({ saved });
  await settled(ui);
  assert.equal(ui.remote.reads.length, 0);
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes.length, 1);
  assert.notEqual(ui.remote.writes[0].id, 'bad');
});

void test('存储被禁用仍可在当前页核对，提示不要在未确认时关闭页面', async () => {
  const denied = () => {
    throw new Error('blocked');
  };
  const ui = harness({
    storage: { getItem: denied, setItem: denied, removeItem: denied },
  });
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save;
  let id;
  ui.remote.api.save = async (target) => {
    id = target;
    throw new Error('timeout');
  };
  await ui.$('cloudSave').click();
  assert.match(ui.$('cloudSaveState').textContent, /不要关闭或刷新/);
  ui.remote.api.save = save;
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes[0].id, id);
});

void test('错误界面不显示原始异常和同步码，三种语言都有保存状态', async () => {
  const ui = harness();
  const code = newSyncCode();
  ui.$('cloudCode').value = code;
  ui.remote.api.list = async () => {
    throw new Error(`Bearer ${code}`);
  };
  await ui.$('cloudConnect').click();
  assert(!ui.$('cloudStatus').textContent.includes(code));
  assert.match(ui.$('cloudStatus').textContent, /serverError/);
  for (const locale of ['zh', 'en', 'es']) {
    ui.language(locale);
    assert(
      ui.$('cloudStatus').textContent.includes(CLOUD_TEXT[locale].serverError),
    );
    assert.deepEqual(
      Object.keys(CLOUD_TEXT[locale]).sort(),
      Object.keys(CLOUD_TEXT.zh).sort(),
    );
  }
});

void test('旧云端 A 保存超时后导入 B，不会把 B 写入 A 的 ID', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  await ui.$('cloudSave').click();
  const original = structuredClone([...ui.remote.rows.values()][0]);
  ui.change((snapshot) => snapshot.starred.push(0));
  const save = ui.remote.api.save;
  ui.remote.api.save = async () => {
    throw new Error('timeout');
  };
  await ui.$('cloudSave').click();
  ui.import({
    ...sample(),
    name: 'B.csv',
    rows: [
      ['different', '其他'],
      ['new', '新的'],
    ],
  });
  ui.remote.api.save = save;
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.writes.length, 1, 'no retry PUT containing B');
  assert.deepEqual([...ui.remote.rows.values()][0], original);
  assert.match(ui.$('cloudStatus').textContent, /不会用当前新词表覆盖/);
  assert.equal(ui.getSnapshot().name, 'B.csv');
});

void test('刷新恢复待核对记录后，无法证明是原词表时禁止重用保存目标', async () => {
  const first = harness();
  await first.$('cloudCreate').click();
  await first.$('cloudSave').click();
  const original = structuredClone([...first.remote.rows.values()][0]);
  first.change((snapshot) => snapshot.starred.push(0));
  const save = first.remote.api.save;
  first.remote.api.save = async () => {
    throw new Error('timeout');
  };
  await first.$('cloudSave').click();
  first.remote.api.save = save;
  const second = harness({
    remote: first.remote,
    saved: first.saved,
    snapshot: { ...sample(), name: 'B.csv' },
  });
  await settled(second);
  await second.$('cloudSave').click();
  assert.equal(first.remote.writes.length, 1);
  assert.deepEqual([...first.remote.rows.values()][0], original);
  assert.match(second.$('cloudStatus').textContent, /不会用当前新词表覆盖/);
});

function withAssociation() {
  const snapshot = sample();
  snapshot.headers.push('联想');
  snapshot.rows[0].push('Imagine a single apple.');
  snapshot.rows[1].push('Imagine a pair of shoes.');
  snapshot.mapping.association = 2;
  return snapshot;
}

void test('旧后端丢弃联想映射时不谎报完整保存，更新后重试沿用已提交版本', async () => {
  const ui = harness({ snapshot: withAssociation() });
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save;
  ui.remote.api.save = async (id, snapshot, revision) => {
    const oldSnapshot = structuredClone(snapshot);
    delete oldSnapshot.mapping.association;
    return save(id, oldSnapshot, revision);
  };
  await ui.$('cloudSave').click();
  const committed = [...ui.remote.rows.values()][0];
  assert.equal(ui.$('cloudSaveState').dataset.state, 'incompatibleCloud');
  assert.match(ui.$('cloudStatus').textContent, /未完整保留/);
  assert.equal(ui.getSnapshot().mapping.association, 2);
  assert.equal(ui.remote.rows.size, 1);
  ui.remote.api.save = save;
  await ui.$('cloudSave').click();
  assert.equal(ui.remote.rows.size, 1);
  assert.equal(ui.remote.writes[1].id, committed.id);
  assert.equal(ui.remote.writes[1].revision, committed.revision);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
});

void test('联想 PUT 成功而 GET 失败后刷新，仍保留已提交目标并仅做读核对', async () => {
  const first = harness({ snapshot: withAssociation() });
  await first.$('cloudCreate').click();
  const load = first.remote.api.load;
  first.remote.api.load = async () => {
    throw new Error('networkError');
  };
  await first.$('cloudSave').click();
  const record = JSON.parse(
    [...first.saved.entries()].find(([key]) =>
      key.startsWith('wordroom-cloud-pending'),
    )[1],
  );
  assert(record.committedRevision);
  assert.equal(first.$('cloudSaveState').dataset.state, 'pendingSave');
  await first.$('cloudSave').click();
  assert.equal(first.remote.writes.length, 1);
  first.remote.api.load = load;
  const second = harness({
    remote: first.remote,
    saved: first.saved,
    snapshot: withAssociation(),
  });
  await settled(second);
  assert.equal(second.$('cloudSaveState').dataset.state, 'clean');
  assert.equal(first.remote.writes.length, 1);
});

void test('两个已连接页面不能用新保存覆盖另一页的待核对标记', async () => {
  const first = harness();
  await first.$('cloudCreate').click();
  const second = harness({ remote: first.remote, saved: first.saved });
  await settled(second);
  const save = first.remote.api.save;
  first.remote.api.save = async () => {
    throw new Error('timeout');
  };
  await first.$('cloudSave').click();
  const marker = [...first.saved.entries()].find(([key]) =>
    key.startsWith('wordroom-cloud-pending'),
  );
  first.remote.api.save = save;
  await second.$('cloudSave').click();
  assert.equal(first.remote.writes.length, 0);
  assert.equal(first.saved.get(marker[0]), marker[1]);
  assert.match(second.$('cloudStatus').textContent, /另一个页面/);
});

void test('保存结束清理时只删除自己相同 ID、版本、摘要的标记', async () => {
  const ui = harness();
  await ui.$('cloudCreate').click();
  const save = ui.remote.api.save;
  let release;
  ui.remote.api.save = async (...args) => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return save(...args);
  };
  const action = ui.$('cloudSave').click();
  for (let i = 0; !release && i < 1000; i++)
    await new Promise((resolve) => setImmediate(resolve));
  assert(release);
  const key = [...ui.saved.keys()].find((item) =>
    item.startsWith('wordroom-cloud-pending'),
  );
  const foreign = JSON.stringify({
    id: crypto.randomUUID(),
    revision: null,
    digest: 'f'.repeat(64),
  });
  ui.saved.set(key, foreign);
  release();
  await action;
  assert.equal(ui.saved.get(key), foreign);
  assert.equal(ui.$('cloudSaveState').dataset.state, 'clean');
});
