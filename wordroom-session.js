import { studyApp, filterReviewWords } from './wordroom.js?v=optimization1';
import { validateSnapshot } from './cloud-data.js?v=optimization1';

const TEXT = {
  zh: {
    title: '本机进度',
    hint: '自动在此浏览器保存词库、星标、位置和造句，不自动上传。关闭后清除本机副本，不影响当前练习或云端。',
    remember: '本机记住进度',
    retry: '重试本机保存',
    loading: '正在检查上次进度…',
    ready: '开始练习后自动保存。',
    restored: '已恢复上次练习。',
    saving: '正在保存本机进度…',
    saved: '本机已保存',
    pending: '有尚未保存的本机进度。',
    disabled: '本机记忆已关闭。',
    failed:
      '本机保存失败或空间不足。当前练习仍在，请重试；关闭页面可能丢失进度。',
    invalid:
      '上次进度无法安全读取，未覆盖它。可先备份所需内容，再关闭本机记忆清除旧记录。',
    conflict:
      '另一页已保存新进度，本页已暂停保存以免覆盖。请保留所需内容后刷新。',
    restoreSkipped:
      '发现上次进度，但你已开始操作。本页暂停保存，旧进度未覆盖；保留当前所需内容后刷新可恢复，或关闭本机记忆清除旧记录。',
  },
  en: {
    title: 'On-device progress',
    hint: 'Auto-save lists, stars, position and drafts in this browser, without uploading. Turning this off clears local progress, not the current session or cloud copies.',
    remember: 'Remember on this device',
    retry: 'Retry local save',
    loading: 'Checking saved progress…',
    ready: 'Progress saves automatically when you study.',
    restored: 'Previous session restored.',
    saving: 'Saving on this device…',
    saved: 'Saved on this device',
    pending: 'Some progress has not been saved yet.',
    disabled: 'On-device memory is off.',
    failed:
      'Local storage failed or is full. Your session is still here. Retry before closing this page.',
    invalid:
      'Saved progress could not be read safely and was not overwritten. Back up what you need, then turn memory off to clear it.',
    conflict:
      'Another tab saved newer progress. Saving here is paused to avoid overwriting it. Keep what you need, then reload.',
    restoreSkipped:
      'Saved progress was found after you started studying. It has not been overwritten. Keep your new work and reload to restore, or turn memory off to clear the saved session.',
  },
  es: {
    title: 'Progreso local',
    hint: 'Guardado automático de listas, favoritas, posición y borradores en este navegador, sin subirlos. Al desactivarlo se borra la copia local, no la sesión ni la nube.',
    remember: 'Recordar en este dispositivo',
    retry: 'Reintentar guardado local',
    loading: 'Comprobando el progreso guardado…',
    ready: 'El progreso se guarda al practicar.',
    restored: 'Sesión anterior restaurada.',
    saving: 'Guardando en este dispositivo…',
    saved: 'Guardado en este dispositivo',
    pending: 'Hay progreso pendiente de guardar.',
    disabled: 'Memoria local desactivada.',
    failed:
      'El almacenamiento local falló o está lleno. La sesión sigue aquí. Reintenta antes de cerrar.',
    invalid:
      'No se pudo leer el progreso con seguridad y no se sobrescribió. Conserva lo necesario y desactiva la memoria para borrarlo.',
    conflict:
      'Otra pestaña guardó progreso más reciente. Se pausó el guardado para no sobrescribirlo. Conserva lo necesario y recarga.',
    restoreSkipped:
      'Se encontró una sesión guardada después de empezar a practicar. No se sobrescribió. Conserva lo nuevo y recarga para restaurarla, o desactiva la memoria para borrarla.',
  },
};

// Validate persistent data as untrusted input before replacing live practice.
export function validateProgress(progress, validated) {
  const invalid = () => {
    throw new Error('invalid');
  };
  if (!progress || typeof progress !== 'object') invalid();
  const sources =
    validated.snapshot.schemaVersion === 1
      ? [validated.snapshot]
      : validated.snapshot.sources;
  const scope = progress.scope;
  if (
    !scope ||
    (scope.source !== 'all' &&
      (!Number.isInteger(scope.source) || !sources[scope.source])) ||
    typeof scope.starredOnly !== 'boolean'
  )
    invalid();
  const indices = new Set(validated.words.map((word) => word.sourceIndex));
  const allowed = new Set(
    filterReviewWords(
      validated.words,
      sources,
      new Set(validated.snapshot.starred),
      scope,
    ).map((word) => word.sourceIndex),
  );
  for (const key of ['deck', 'drawn']) {
    const list = progress[key];
    if (
      !Array.isArray(list) ||
      list.length > allowed.size ||
      new Set(list).size !== list.length ||
      list.some((index) => !Number.isInteger(index) || !allowed.has(index))
    )
      invalid();
  }
  if (
    progress.deck.length !== allowed.size ||
    !Number.isInteger(progress.index) ||
    progress.index < 0 ||
    progress.index >= Math.max(1, progress.deck.length) ||
    typeof progress.flipped !== 'boolean' ||
    !Number.isInteger(progress.drawPage) ||
    progress.drawPage < 0 ||
    progress.drawPage >= Math.max(1, Math.ceil(progress.drawn.length / 12)) ||
    !Number.isInteger(progress.activeSource) ||
    !sources[progress.activeSource] ||
    typeof progress.isSample !== 'boolean' ||
    !['cards', 'draw'].includes(progress.view) ||
    !Number.isInteger(progress.drawCount) ||
    progress.drawCount < 1 ||
    progress.drawCount > 20000 ||
    !Array.isArray(progress.answers) ||
    progress.answers.length > indices.size
  )
    invalid();
  let characters = 0;
  const seen = new Set();
  for (const entry of progress.answers) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      !indices.has(entry[0]) ||
      seen.has(entry[0]) ||
      typeof entry[1] !== 'string'
    )
      invalid();
    seen.add(entry[0]);
    characters += entry[1].length;
    if (characters > 5 * 1024 * 1024) invalid();
  }
  return progress;
}

export function createSessionStore(
  factory = globalThis.indexedDB,
  key = globalThis.location?.pathname || '/',
) {
  let connection;
  function open() {
    if (!factory) return Promise.reject(new Error('failed'));
    if (!connection)
      connection = new Promise((resolve, reject) => {
        const request = factory.open('wordroom-local-progress', 1);
        let expired = false;
        const fail = (error) => {
          expired = true;
          clearTimeout(timer);
          reject(error);
        };
        const timer = setTimeout(() => fail(new Error('failed')), 5000);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('sessions');
        request.onerror = () => {
          fail(request.error);
        };
        request.onblocked = () => {
          fail(new Error('failed'));
        };
        request.onsuccess = () => {
          clearTimeout(timer);
          if (expired) {
            request.result.close();
            return;
          }
          request.result.onversionchange = () => {
            request.result.close();
            connection = null;
          };
          resolve(request.result);
        };
      }).catch((error) => {
        connection = null;
        throw error;
      });
    return connection;
  }
  return {
    async read() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readonly'),
          store = tx.objectStore('sessions');
        const requests = ['meta', 'library', 'progress'].map((part) =>
          store.get(`${key}:${part}`),
        );
        tx.oncomplete = () =>
          resolve({
            meta: requests[0].result,
            library: requests[1].result,
            progress: requests[2].result,
          });
        tx.onabort = tx.onerror = () => reject(tx.error || new Error('failed'));
      });
    },
    async write({ expectedRevision, library, progress, enabled = true }) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', 'readwrite'),
          store = tx.objectStore('sessions');
        const revision = crypto.randomUUID();
        const request = store.get(`${key}:meta`);
        let failure;
        request.onsuccess = () => {
          if ((request.result?.revision ?? null) !== expectedRevision) {
            failure = new Error('conflict');
            tx.abort();
            return;
          }
          if (!enabled) {
            store.delete(`${key}:library`);
            store.delete(`${key}:progress`);
          } else {
            if (library) store.put(library, `${key}:library`);
            store.put(progress, `${key}:progress`);
          }
          store.put(
            { version: 1, revision, enabled, savedAt: Date.now() },
            `${key}:meta`,
          );
        };
        tx.oncomplete = () => resolve(revision);
        tx.onabort = tx.onerror = () =>
          reject(failure || tx.error || new Error('failed'));
      });
    },
  };
}

export async function startSession(
  app,
  {
    doc = globalThis.document,
    win = globalThis.window,
    store = createSessionStore(),
    schedule = globalThis.setTimeout,
    cancel = globalThis.clearTimeout,
  } = {},
) {
  if (!app || !doc?.querySelector('#localRemember')) return;
  const $ = (id) => doc.querySelector(`#${id}`);
  let status = 'loading',
    enabled = true,
    revision = null,
    initialized = false;
  let dirty = false,
    libraryDirty = true,
    writing = false,
    paused = false,
    restoring = false,
    timer,
    generation = 0,
    contentGeneration = 0;
  let validatedLibrary = null;
  function render() {
    const text = TEXT[app.getLocale()] || TEXT.zh;
    doc.querySelectorAll('[data-session-text]').forEach((node) => {
      node.textContent = text[node.dataset.sessionText];
    });
    $('localStatus').textContent = text[status];
    $('localStatus').dataset.state = [
      'failed',
      'invalid',
      'conflict',
      'restoreSkipped',
    ].includes(status)
      ? 'error'
      : 'normal';
    $('localRemember').checked = enabled;
    $('localRemember').disabled =
      !initialized || writing || status === 'conflict';
    $('localRetry').hidden = status !== 'failed';
  }
  async function flush() {
    cancel(timer);
    if (!initialized || !enabled || !dirty || writing || paused) return;
    const ticket = generation,
      contentTicket = contentGeneration;
    writing = true;
    status = 'saving';
    render();
    try {
      const session = app.captureSession(libraryDirty);
      const validated = session.library
        ? validateSnapshot(session.library)
        : validatedLibrary;
      if (!validated) throw new Error('failed');
      validateProgress(session.progress, validated);
      revision = await store.write({ expectedRevision: revision, ...session });
      validatedLibrary = validated;
      dirty = generation !== ticket;
      libraryDirty = contentGeneration !== contentTicket;
      status = dirty ? 'pending' : 'saved';
    } catch (error) {
      status = error?.message === 'conflict' ? 'conflict' : 'failed';
      paused = true;
    } finally {
      writing = false;
      render();
      if (dirty && !paused) timer = schedule(() => void flush(), 250);
    }
  }
  const off = app.onChange(({ cloud }) => {
    if (restoring) return;
    generation++;
    if (cloud) {
      contentGeneration++;
      libraryDirty = true;
    }
    dirty = true;
    if (initialized && enabled && !paused) {
      status = writing ? 'saving' : 'pending';
      render();
      cancel(timer);
      timer = schedule(() => void flush(), 250);
    }
  });
  render();
  try {
    const session = await store.read();
    revision = session.meta?.revision ?? null;
    if (
      session.meta &&
      (session.meta.version !== 1 ||
        typeof session.meta.enabled !== 'boolean' ||
        typeof revision !== 'string')
    )
      throw new Error('invalid');
    enabled = session.meta?.enabled !== false;
    if (enabled && session.meta) {
      const validated = validateSnapshot(session.library);
      const progress = validateProgress(session.progress, validated);
      if (!dirty) {
        restoring = true;
        app.restoreSession(validated, progress);
        restoring = false;
        libraryDirty = false;
        validatedLibrary = validated;
        status = 'restored';
      } else {
        status = 'restoreSkipped';
        paused = true;
      }
    } else status = enabled ? 'ready' : 'disabled';
  } catch (error) {
    restoring = false;
    status = revision
      ? 'invalid'
      : error?.message === 'invalid'
        ? 'invalid'
        : 'failed';
    paused = true;
  }
  initialized = true;
  render();
  if (dirty && enabled && !paused) timer = schedule(() => void flush(), 250);
  $('localRemember').addEventListener('change', async () => {
    if (writing || status === 'conflict') {
      render();
      return;
    }
    const next = $('localRemember').checked;
    if (next) {
      enabled = true;
      paused = false;
      dirty = true;
      libraryDirty = true;
      await flush();
    } else {
      cancel(timer);
      writing = true;
      render();
      try {
        revision = await store.write({
          expectedRevision: revision,
          enabled: false,
        });
        enabled = false;
        paused = false;
        dirty = false;
        libraryDirty = true;
        status = 'disabled';
      } catch (error) {
        status = error?.message === 'conflict' ? 'conflict' : 'failed';
        paused = true;
      }
      writing = false;
      render();
    }
  });
  $('localRetry').addEventListener('click', () => {
    paused = false;
    dirty = true;
    return flush();
  });
  $('languageSelect').addEventListener('change', render);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') void flush();
  });
  win?.addEventListener('pagehide', () => void flush());
  win?.addEventListener('beforeunload', (event) => {
    if (enabled && dirty) {
      void flush();
      event.preventDefault();
      // oxlint-disable-next-line typescript/no-deprecated -- Legacy browsers also require returnValue for unsaved-work warnings.
      event.returnValue = '';
    }
  });
  return {
    flush,
    stop: () => {
      off();
      cancel(timer);
    },
    getStatus: () => status,
  };
}

if (studyApp && typeof document !== 'undefined') void startSession(studyApp);
