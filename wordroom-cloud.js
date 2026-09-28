import { studyApp, escapeHTML } from './wordroom.js?v=optimization1';
import {
  newSyncCode,
  validSyncCode,
  validateSnapshot,
} from './cloud-data.js?v=optimization1';
import {
  CloudClient,
  cloudErrorCode,
  uncertainSave,
} from './cloud-client.js?v=optimization1';
import { CLOUD_API_URL } from './cloud-config.js';

export const CLOUD_TEXT = {
  zh: {
    title: '云端词表',
    intro: '主动保存词表和星标；换设备后用同步码找回。不影响本地练习。',
    codeLabel: '专属同步码',
    privacy:
      '同步码相当于密码。有它的人可以读写你的词表；丢失后无法找回，请妥善保管。',
    connect: '连接',
    create: '创建同步码',
    copy: '复制同步码',
    disconnect: '退出同步',
    nameLabel: '保存名称',
    save: '保存当前词表',
    listLabel: '已保存的词表',
    refresh: '刷新',
    load: '打开词表',
    delete: '删除云端副本',
    saveHint:
      '从云端打开后保存会更新原词表；导入新 CSV 后保存会新增一份。造句草稿不上传。',
    limits: '最多 20 份词表，共 40 MB。仅点击保存时上传。',
    empty: '尚未保存词表',
    busy: '正在处理…',
    connected: '已连接。同步码仅记在当前设备，请复制备份。',
    connectedTemporary: '已连接，但浏览器无法记住同步码。请立即复制备份。',
    disconnected: '已退出当前设备。云端词表仍然保留。',
    disconnectBlocked:
      '已断开当前页面，但浏览器阻止清除同步码。公共设备上请清除此网站的浏览器数据。',
    saved: '词表和星标已保存到云端。',
    savedEarlier: '刚才的词表快照已保存；当前又有更改，请再次保存。',
    unsaved: '已连接 · 当前词表尚未保存到云端。',
    dirty: '已连接 · 有修改尚未保存到云端。',
    clean: '已连接 · 当前词表和星标已保存。造句仅保存在本机。',
    lastSaved: '最近确认的云端保存：',
    pendingSave:
      '上次保存结果尚未确认。请点击“刷新”核对；再次保存前也会先核对，不会重复新增副本。',
    retrySave:
      '未发现上次保存的新版本。可再次点击保存，将沿用同一副本编号，并检查版本冲突。',
    pendingTemporary:
      '浏览器无法记住待核对状态，请在核对完成前不要关闭或刷新页面。',
    pendingSourceChanged:
      '上次保存属于另一份词表，尚未确认。请先刷新核对，或打开对应云端词表；不会用当前新词表覆盖它。',
    pendingElsewhere:
      '另一个页面有尚未确认的保存。请先在那个页面核对结果，再刷新此页；当前词表未上传。',
    incompatibleCloud:
      '云端已收到词表，但未完整保留“联想”设置。请更新云端服务后再次保存；当前内容仍在本机，不会显示为已完整保存。',
    networkError:
      '暂时无法连接云端。请检查网络、代理或 VPN，以及 Cloudflare 的网站来源设置；本地练习不受影响。',
    originDenied:
      '云端不允许当前网站来源。请检查 Cloudflare 的 ALLOWED_ORIGINS 设置。',
    diagnostic: '诊断代码：',
    loaded: '已打开云端词表，星标已恢复。',
    deleted: '已删除云端副本，当前练习不受影响。',
    copied: '同步码已复制。请保存在安全的地方，不要公开分享。',
    copyFailed: '无法自动复制。同步码已选中，请手动复制并妥善保管。',
    refreshed: '云端列表已刷新。',
    confirmLoad:
      '打开云端词表将替换当前词表，并清空本页造句草稿。未保存的星标也会丢失。继续吗？',
    confirmDelete:
      '删除这份云端词表？这不会清空当前页面，其他设备将无法再读取此副本。',
    confirmDisconnect:
      '退出后，本设备将忘记同步码。请确认已复制备份；云端词表不会删除。继续吗？',
    invalidCode: '同步码格式不正确，请完整粘贴以 wr1_ 开头的同步码。',
    invalidSnapshot: '词表数据无效，未保存或替换当前练习。',
    invalidResponse: '云端返回的数据无效，当前练习已保留。',
    cloudTooLarge: '云端快照超过 10 MB，请缩小词表后重试。本地练习不受影响。',
    quotaExceeded:
      '最多保存 20 份词表，总容量 40 MB。请删除不需要的云端副本后重试。',
    conflict:
      '云端已有更新或词表已被删除。请先备份当前内容，再重新打开云端词表；不会覆盖较新的版本。',
    notFound: '云端词表已不存在，请刷新列表。',
    rateLimited: '操作过于频繁，请等一分钟再试。',
    timeout: '请求超时。当前练习仍在；保存结果不确定时请刷新云端列表核对。',
    changed: '读取期间本地内容发生了变化，已取消切换以保留当前练习。',
    nameRequired: '请填写保存名称。',
    serverError: '暂时无法连接云端，请稍后重试。本地练习不受影响。',
    notConfigured: '云端服务尚未配置。',
  },
  en: {
    title: 'Cloud word lists',
    intro:
      'Save words and stars, then use your sync code on another device. Local practice stays available.',
    codeLabel: 'Private sync code',
    privacy:
      'Treat this code like a password. Anyone with it can read and change your lists. Lost codes cannot be recovered.',
    connect: 'Connect',
    create: 'Create sync code',
    copy: 'Copy sync code',
    disconnect: 'Disconnect',
    nameLabel: 'List name',
    save: 'Save current list',
    listLabel: 'Saved lists',
    refresh: 'Refresh',
    load: 'Open list',
    delete: 'Delete cloud copy',
    saveHint:
      'Saving an opened cloud list updates it. Importing a new CSV creates a separate list on save. Sentence drafts are not uploaded.',
    limits: 'Up to 20 lists, 40 MB total. Uploads happen only when you save.',
    empty: 'No saved lists yet',
    busy: 'Working…',
    connected:
      'Connected. This device remembers your code; copy it somewhere safe.',
    connectedTemporary:
      'Connected, but this browser cannot remember the code. Copy it now.',
    disconnected:
      'Disconnected on this device. Your cloud lists are still stored.',
    disconnectBlocked:
      'This page is disconnected, but the browser blocked removing the code. On a shared device, clear this site’s browser data.',
    saved: 'Words and stars saved to the cloud.',
    savedEarlier:
      'The earlier snapshot was saved. You made more changes; save again to include them.',
    unsaved: 'Connected · This list has not been saved to the cloud.',
    dirty: 'Connected · Changes have not been saved to the cloud.',
    clean:
      'Connected · Words and stars are saved. Sentence drafts stay on this device.',
    lastSaved: 'Last confirmed cloud save: ',
    pendingSave:
      'The last save is unconfirmed. Refresh to check; saving again also checks first and will not create a duplicate copy.',
    retrySave:
      'The last save has not appeared. Save again to reuse the same copy ID with version-conflict protection.',
    pendingTemporary:
      'This browser cannot remember the pending check. Do not close or reload until the save is verified.',
    pendingSourceChanged:
      'The unconfirmed save belongs to a different list. Refresh to verify it or open that cloud list first. This new list will not replace it.',
    pendingElsewhere:
      'Another page has an unconfirmed save. Verify it there, then refresh this page. Your current list was not uploaded.',
    incompatibleCloud:
      'The cloud received the list but did not retain all association settings. Update the cloud service and save again. Local content is safe and will not be marked fully saved.',
    networkError:
      'Cloud connection failed. Check the network, proxy or VPN, and the Cloudflare allowed-origin setting. Local practice is safe.',
    originDenied:
      'The cloud does not allow this website origin. Check ALLOWED_ORIGINS in Cloudflare.',
    diagnostic: 'Diagnostic code: ',
    loaded: 'Cloud list opened and stars restored.',
    deleted: 'Cloud copy deleted. Your current practice is unchanged.',
    copied: 'Code copied. Keep it safe and do not share it publicly.',
    copyFailed:
      'Automatic copy failed. The code is selected; copy it manually and keep it safe.',
    refreshed: 'Cloud list refreshed.',
    confirmLoad:
      'Opening a cloud list replaces the current list and clears sentence drafts. Unsaved stars will also be lost. Continue?',
    confirmDelete:
      'Delete this cloud list? Your current page stays unchanged, but other devices can no longer retrieve this copy.',
    confirmDisconnect:
      'This device will forget your sync code. Make sure you have copied it; cloud lists will not be deleted. Continue?',
    invalidCode: 'Paste the complete sync code starting with wr1_.',
    invalidSnapshot:
      'Invalid word-list data. Your current practice has not been replaced.',
    invalidResponse:
      'The cloud returned invalid data. Your current practice is safe.',
    cloudTooLarge:
      'The cloud snapshot exceeds 10 MB. Use a smaller list; local practice is unaffected.',
    quotaExceeded:
      'Storage limit: 20 lists and 40 MB total. Delete an unneeded cloud copy and retry.',
    conflict:
      'The cloud list was changed or deleted elsewhere. Back up your work, then reopen the cloud list. Newer data will not be overwritten.',
    notFound: 'This cloud list no longer exists. Refresh the list.',
    rateLimited: 'Too many requests. Try again in a minute.',
    timeout:
      'Request timed out. Your practice is safe; refresh the cloud list to check whether a save completed.',
    changed:
      'Local content changed while loading. The switch was canceled to protect your work.',
    nameRequired: 'Enter a list name.',
    serverError:
      'Cloud unavailable. Try again later; local practice still works.',
    notConfigured: 'Cloud storage is not configured yet.',
  },
  es: {
    title: 'Listas en la nube',
    intro:
      'Guarda palabras y favoritas, y recupéralas en otro dispositivo con tu código. Puedes seguir practicando localmente.',
    codeLabel: 'Código de sincronización privado',
    privacy:
      'Trátalo como una contraseña. Quien tenga el código puede leer y modificar tus listas. No se pueden recuperar códigos perdidos.',
    connect: 'Conectar',
    create: 'Crear código',
    copy: 'Copiar código',
    disconnect: 'Desconectar',
    nameLabel: 'Nombre de la lista',
    save: 'Guardar lista actual',
    listLabel: 'Listas guardadas',
    refresh: 'Actualizar',
    load: 'Abrir lista',
    delete: 'Eliminar copia en la nube',
    saveHint:
      'Guardar una lista abierta desde la nube la actualiza. Importar otro CSV crea una lista nueva al guardarla. Los borradores de oraciones no se suben.',
    limits:
      'Hasta 20 listas y 40 MB en total. Solo se suben al pulsar Guardar.',
    empty: 'Aún no hay listas guardadas',
    busy: 'Procesando…',
    connected:
      'Conectado. Este dispositivo recuerda el código; cópialo en un lugar seguro.',
    connectedTemporary:
      'Conectado, pero el navegador no puede recordar el código. Cópialo ahora.',
    disconnected: 'Dispositivo desconectado. Tus listas siguen en la nube.',
    disconnectBlocked:
      'Esta página está desconectada, pero el navegador impidió borrar el código. En un dispositivo compartido, borra los datos de este sitio.',
    saved: 'Palabras y favoritas guardadas en la nube.',
    savedEarlier:
      'Se guardó la versión anterior. Hay cambios nuevos; vuelve a guardar para incluirlos.',
    unsaved: 'Conectado · Esta lista aún no se ha guardado en la nube.',
    dirty: 'Conectado · Hay cambios sin guardar en la nube.',
    clean:
      'Conectado · Palabras y favoritas guardadas. Los borradores se quedan en este dispositivo.',
    lastSaved: 'Último guardado confirmado: ',
    pendingSave:
      'El último guardado no está confirmado. Actualiza para comprobarlo; al volver a guardar también se comprobará primero, sin crear copias duplicadas.',
    retrySave:
      'El último guardado no aparece. Vuelve a guardar para usar el mismo identificador con protección contra conflictos de versión.',
    pendingTemporary:
      'El navegador no puede recordar la comprobación pendiente. No cierres ni recargues hasta verificar el guardado.',
    pendingSourceChanged:
      'El guardado pendiente corresponde a otra lista. Actualiza para verificarlo o abre esa lista de la nube. Esta nueva lista no la sustituirá.',
    pendingElsewhere:
      'Otra página tiene un guardado sin confirmar. Verifícalo allí y actualiza esta página. La lista actual no se ha subido.',
    incompatibleCloud:
      'La nube recibió la lista, pero no conservó todos los ajustes de asociación. Actualiza el servicio y vuelve a guardar. El contenido local está seguro y no se marcará como guardado completo.',
    networkError:
      'No se pudo conectar. Revisa la red, el proxy o VPN y los orígenes permitidos de Cloudflare. Tu práctica local sigue intacta.',
    originDenied:
      'La nube no permite el origen de este sitio. Revisa ALLOWED_ORIGINS en Cloudflare.',
    diagnostic: 'Código de diagnóstico: ',
    loaded: 'Lista abierta y favoritas recuperadas.',
    deleted: 'Copia en la nube eliminada. Tu práctica actual no ha cambiado.',
    copied:
      'Código copiado. Guárdalo de forma segura y no lo compartas públicamente.',
    copyFailed:
      'No se pudo copiar automáticamente. El código está seleccionado; cópialo manualmente y guárdalo.',
    refreshed: 'Lista de la nube actualizada.',
    confirmLoad:
      'Abrir la lista de la nube sustituirá la actual y borrará los borradores de oraciones y las favoritas sin guardar. ¿Continuar?',
    confirmDelete:
      '¿Eliminar esta lista de la nube? La página actual no cambiará, pero otros dispositivos ya no podrán recuperar esta copia.',
    confirmDisconnect:
      'Este dispositivo olvidará el código. Asegúrate de haberlo copiado; no se eliminarán las listas de la nube. ¿Continuar?',
    invalidCode: 'Pega el código completo que empieza por wr1_.',
    invalidSnapshot:
      'Datos de vocabulario no válidos. Tu práctica actual no se ha sustituido.',
    invalidResponse:
      'La nube devolvió datos no válidos. Tu práctica sigue intacta.',
    cloudTooLarge:
      'La copia supera los 10 MB. Usa una lista más pequeña; la práctica local no se ve afectada.',
    quotaExceeded:
      'Límite de almacenamiento: 20 listas y 40 MB en total. Elimina una copia que no necesites e inténtalo de nuevo.',
    conflict:
      'La lista cambió o se eliminó en otro dispositivo. Guarda una copia de tu trabajo y vuelve a abrir la lista de la nube. No se sobrescribirán datos más recientes.',
    notFound: 'Esta lista ya no existe. Actualiza las listas.',
    rateLimited: 'Demasiadas solicitudes. Inténtalo en un minuto.',
    timeout:
      'Se agotó el tiempo. Tu práctica sigue intacta; actualiza las listas para comprobar si se completó el guardado.',
    changed:
      'El contenido local cambió durante la carga. Se canceló el cambio para proteger tu trabajo.',
    nameRequired: 'Escribe un nombre para la lista.',
    serverError:
      'La nube no está disponible. Inténtalo más tarde; puedes seguir practicando localmente.',
    notConfigured: 'La nube aún no está configurada.',
  },
};

async function fingerprint(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function snapshotFingerprint(snapshot) {
  return fingerprint(validateSnapshot(snapshot).serialized);
}

function validPending(value) {
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  return (
    value &&
    uuid.test(value.id) &&
    (value.revision === null || uuid.test(value.revision)) &&
    (value.committedRevision === undefined ||
      uuid.test(value.committedRevision)) &&
    /^[a-f0-9]{64}$/.test(value.digest)
  );
}

export function startCloud(
  app,
  {
    document: doc = document,
    storage = {
      getItem: (key) => globalThis.localStorage.getItem(key),
      setItem: (key, value) => globalThis.localStorage.setItem(key, value),
      removeItem: (key) => globalThis.localStorage.removeItem(key),
    },
    confirm = (text) => window.confirm(text),
    client = (code) => new CloudClient(CLOUD_API_URL, code),
    clipboard = () => navigator.clipboard,
  } = {},
) {
  const $ = (selector) => doc.querySelector(selector);
  const storageKey = 'wordroom-cloud-code-v1';
  let api = null,
    code = '',
    entries = [],
    current = null,
    importId = -1,
    busy = false,
    statusKey = '',
    statusError = false,
    diagnostic = '',
    savedContentId = -1,
    savedName = '',
    lastSavedAt = 0,
    pending = null,
    pendingKey = '';
  const contentId = () => app.getContentChangeId?.() ?? app.getChangeId();
  const text = (key) =>
    (CLOUD_TEXT[app.getLocale()] || CLOUD_TEXT.zh)[key] ||
    CLOUD_TEXT[app.getLocale()]?.serverError ||
    CLOUD_TEXT.zh.serverError;
  function status(key, error = false, detail = '') {
    statusKey = key;
    statusError = error;
    diagnostic = detail;
    $('#cloudStatus').textContent =
      (key ? text(key) : '') +
      (detail ? ` ${text('diagnostic')}${detail}` : '');
    $('#cloudStatus').dataset.state = error ? 'error' : 'success';
  }
  function isDirty() {
    return (
      !current ||
      importId !== app.getImportId() ||
      savedContentId !== contentId() ||
      savedName !== $('#cloudName').value.trim()
    );
  }
  function renderSaveState() {
    const node = $('#cloudSaveState');
    if (!node) return;
    const state = pending
      ? pending.mappingMismatch
        ? 'incompatibleCloud'
        : pending.conflict
          ? 'conflict'
          : 'pendingSave'
      : !current || importId !== app.getImportId()
        ? 'unsaved'
        : isDirty()
          ? 'dirty'
          : 'clean';
    node.textContent = api ? text(state) : '';
    if (api && lastSavedAt) {
      const date = new Date(lastSavedAt).toLocaleString(app.getLocale());
      node.textContent += ` ${text('lastSaved')}${date}`;
    }
    if (api && pending && !pending.durable)
      node.textContent += ` ${text('pendingTemporary')}`;
    node.dataset.state = state;
  }
  function samePending(left, right) {
    return (
      left &&
      right &&
      left.id === right.id &&
      left.revision === right.revision &&
      left.digest === right.digest
    );
  }
  function storePending(operation) {
    let readable = true;
    try {
      const existing = JSON.parse(storage.getItem(pendingKey) || 'null');
      // A second tab must not replace the first tab's unresolved operation.
      if (validPending(existing) && !samePending(existing, pending))
        throw new Error('pendingElsewhere');
    } catch (error) {
      if (error?.message === 'pendingElsewhere') throw error;
      readable = false;
    }
    pending = operation;
    pending.durable = false;
    if (!readable) return;
    try {
      // No vocabulary, list names, sync codes, or sentence drafts are stored here.
      storage.setItem(
        pendingKey,
        JSON.stringify({
          id: operation.id,
          revision: operation.revision,
          digest: operation.digest,
          ...(operation.committedRevision
            ? { committedRevision: operation.committedRevision }
            : {}),
        }),
      );
      pending.durable = true;
    } catch {
      pending.durable = false;
    }
  }
  function clearPending() {
    const operation = pending;
    pending = null;
    try {
      const stored = JSON.parse(storage.getItem(pendingKey) || 'null');
      if (samePending(stored, operation)) storage.removeItem(pendingKey);
    } catch {}
  }
  function rememberCommitted(entry, operation) {
    if (operation.sourceId === app.getImportId()) {
      current = entry;
      importId = operation.sourceId;
      savedContentId = -1;
      savedName = entry.name;
    }
    entries = [entry, ...entries.filter((row) => row.id !== entry.id)];
  }
  async function acceptSave(entry, operation) {
    let sameSource = operation.sourceId === app.getImportId();
    let checkpoint = operation.contentId;
    // After a reload, only bind a recovered operation to matching local content.
    if (operation.sourceId == null) {
      const snapshot = app.capture();
      snapshot.name = $('#cloudName').value.trim();
      checkpoint = contentId();
      const sourceId = app.getImportId();
      try {
        sameSource =
          (await snapshotFingerprint(snapshot)) === operation.digest &&
          sourceId === app.getImportId();
      } catch {
        // A newer local list can exceed the cloud limit; still acknowledge the
        // verified earlier save without replacing or binding that local list.
        sameSource = false;
      }
    }
    if (sameSource) {
      current = entry;
      importId = app.getImportId();
      savedContentId = checkpoint;
      savedName = entry.name;
    }
    lastSavedAt = entry.updatedAt;
    entries = [entry, ...entries.filter((row) => row.id !== entry.id)];
    clearPending();
    status(isDirty() ? 'savedEarlier' : 'saved');
  }
  async function reconcileSave() {
    if (!pending) return 'none';
    const operation = pending;
    let loaded;
    try {
      loaded = await api.load(operation.id);
    } catch (error) {
      if (cloudErrorCode(error) === 'notFound') {
        // A missing existing revision is a deletion, not permission to recreate it.
        if (operation.revision !== null || operation.committedRevision) {
          clearPending();
          throw new Error('conflict');
        }
        return 'retry';
      }
      return 'unknown';
    }
    if (
      (await snapshotFingerprint(loaded.validated.snapshot)) ===
      operation.digest
    ) {
      await acceptSave(loaded.entry, operation);
      return 'saved';
    }
    if (loaded.entry.revision === operation.committedRevision) {
      // This exact revision is known to be our successful PUT, but an older
      // backend may discard a newly supported field. Never mark it clean.
      rememberCommitted(loaded.entry, operation);
      operation.mappingMismatch = true;
      return 'incompatible';
    }
    if (loaded.entry.revision === operation.revision) return 'retry';
    // Never take a newly observed revision and use it to overwrite another device.
    operation.conflict = true;
    throw new Error('conflict');
  }
  function reconciliationStatus(result) {
    return result === 'retry'
      ? 'retrySave'
      : result === 'incompatible'
        ? 'incompatibleCloud'
        : 'pendingSave';
  }
  function render() {
    doc.querySelectorAll('[data-cloud-text]').forEach((node) => {
      node.textContent = text(node.dataset.cloudText);
    });
    $('#cloudCode').readOnly = Boolean(api);
    $('#cloudConnectActions').classList.toggle('hide', Boolean(api));
    $('#cloudSessionActions').classList.toggle('hide', !api);
    $('#cloudLibrary').classList.toggle('hide', !api);
    const selection = $('#cloudSelect').value;
    $('#cloudSelect').innerHTML = entries.length
      ? entries
          .map(
            (entry) =>
              `<option value="${entry.id}">${escapeHTML(entry.name)} · ${entry.wordCount}</option>`,
          )
          .join('')
      : `<option value="">${text('empty')}</option>`;
    $('#cloudSelect').value = entries.some((entry) => entry.id === selection)
      ? selection
      : entries[0]?.id || '';
    for (const id of [
      'cloudConnect',
      'cloudCreate',
      'cloudCopy',
      'cloudDisconnect',
      'cloudSave',
      'cloudRefresh',
    ])
      $('#' + id).disabled = busy;
    $('#cloudLoad').disabled = busy || !entries.length;
    $('#cloudDelete').disabled = busy || !entries.length;
    $('#cloudSelect').disabled = busy || !entries.length;
    $('#cloudCode').disabled = busy;
    $('#cloudName').disabled = busy;
    status(statusKey, statusError, diagnostic);
    renderSaveState();
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    status('busy');
    render();
    try {
      await action();
    } catch (error) {
      const key = [
        'changed',
        'nameRequired',
        'pendingSave',
        'retrySave',
        'pendingSourceChanged',
        'pendingElsewhere',
        'incompatibleCloud',
      ].includes(error?.message)
        ? error.message
        : cloudErrorCode(error);
      const label = Object.hasOwn(CLOUD_TEXT.zh, key) ? key : 'serverError';
      const http =
        Number.isInteger(error?.status) &&
        error.status >= 400 &&
        error.status <= 599
          ? ` / HTTP ${error.status}`
          : '';
      status(label, true, key + http);
    } finally {
      busy = false;
      render();
    }
  }
  async function connect(nextCode) {
    if (!validSyncCode(nextCode)) throw new Error('invalidCode');
    const candidate = client(nextCode);
    const lists = await candidate.list();
    api = candidate;
    code = nextCode;
    entries = lists;
    current = null;
    importId = -1;
    savedContentId = -1;
    lastSavedAt = 0;
    pending = null;
    pendingKey = 'wordroom-cloud-pending-v1:' + (await fingerprint(code));
    $('#cloudCode').value = code;
    $('#cloudName').value = app.capture().name.slice(0, 200);
    let remembered = false;
    try {
      storage.setItem(storageKey, code);
      remembered = true;
    } catch {}
    status(remembered ? 'connected' : 'connectedTemporary');
    try {
      const stored = JSON.parse(storage.getItem(pendingKey) || 'null');
      if (validPending(stored))
        pending = {
          id: stored.id,
          revision: stored.revision,
          digest: stored.digest,
          ...(stored.committedRevision
            ? { committedRevision: stored.committedRevision }
            : {}),
          durable: true,
        };
    } catch {}
    if (pending) {
      const result = await reconcileSave();
      if (result !== 'saved') status(reconciliationStatus(result), true);
    }
  }
  $('#cloudConnect').addEventListener('click', () =>
    run(() => connect($('#cloudCode').value.trim())),
  );
  $('#cloudCreate').addEventListener('click', () =>
    run(() => connect(newSyncCode())),
  );
  $('#cloudCopy').addEventListener('click', () =>
    run(async () => {
      try {
        await clipboard().writeText(code);
        status('copied');
      } catch {
        $('#cloudCode').disabled = false;
        $('#cloudCode').focus();
        $('#cloudCode').select();
        status('copyFailed');
      }
    }),
  );
  $('#cloudDisconnect').addEventListener('click', () => {
    if (busy || !confirm(text('confirmDisconnect'))) return;
    let removed = true;
    try {
      storage.removeItem(storageKey);
    } catch {
      removed = false;
    }
    api = null;
    code = '';
    current = null;
    entries = [];
    pending = null;
    lastSavedAt = 0;
    $('#cloudCode').value = '';
    status(removed ? 'disconnected' : 'disconnectBlocked', !removed);
    render();
  });
  $('#cloudRefresh').addEventListener('click', () =>
    run(async () => {
      entries = await api.list();
      if (pending) {
        const result = await reconcileSave();
        if (result !== 'saved') status(reconciliationStatus(result), true);
      } else status('refreshed');
    }),
  );
  $('#cloudSave').addEventListener('click', () =>
    run(async () => {
      let target = null;
      const wasRetry = Boolean(pending);
      if (pending) {
        const result = await reconcileSave();
        if (result === 'saved') return;
        if (!['retry', 'incompatible'].includes(result))
          throw new Error('pendingSave');
      }
      const snapshot = app.capture();
      snapshot.name = $('#cloudName').value.trim();
      if (!snapshot.name) throw new Error('nameRequired');
      const sourceId = app.getImportId(),
        checkpoint = contentId();
      const digest = await snapshotFingerprint(snapshot);
      if (pending) {
        // An imported list must never be substituted into the unresolved PUT
        // for a previous cloud list. After reload, require exact content proof.
        if (
          pending.sourceId == null
            ? pending.digest !== digest
            : pending.sourceId !== sourceId
        )
          throw new Error('pendingSourceChanged');
        target = {
          id: pending.id,
          revision: pending.committedRevision || pending.revision,
        };
      }
      target ??=
        current && importId === sourceId
          ? current
          : { id: crypto.randomUUID(), revision: null };
      const operation = {
        id: target.id,
        revision: target.revision,
        digest,
        sourceId,
        contentId: checkpoint,
      };
      // Persist BEFORE the request so a reload cannot forget its target ID.
      storePending(operation);
      let entry;
      try {
        entry = await api.save(target.id, snapshot, target.revision);
      } catch (error) {
        if (!uncertainSave(error)) {
          // A definite failure of a retry does not cancel the older request,
          // which may still finish. Keep its ID until readback is conclusive.
          if (!wasRetry) clearPending();
          throw error;
        }
        const result = await reconcileSave();
        if (result === 'saved') return;
        // GET verification never retries the PUT automatically.
        status(reconciliationStatus(result), true, cloudErrorCode(error));
        return;
      }
      const sources =
        snapshot.schemaVersion === 1 ? [snapshot] : snapshot.sources;
      if (
        sources.some((source) => Number.isInteger(source.mapping.association))
      ) {
        // Older deployed Workers may acknowledge a PUT while stripping the new
        // mapping. Verify this newly supported field before claiming success.
        // Remember the known commit even if GET fails, to prevent a new copy.
        rememberCommitted(entry, operation);
        operation.committedRevision = entry.revision;
        storePending(operation);
        const result = await reconcileSave();
        if (result !== 'saved') status(reconciliationStatus(result), true);
      } else await acceptSave(entry, operation);
    }),
  );
  $('#cloudLoad').addEventListener('click', () => {
    if (busy || !confirm(text('confirmLoad'))) return;
    const id = $('#cloudSelect').value,
      changeId = app.getChangeId();
    return run(async () => {
      const { entry, validated } = await api.load(id);
      if (app.getChangeId() !== changeId) throw new Error('changed');
      app.restore(validated);
      current = entry;
      importId = app.getImportId();
      savedContentId = contentId();
      savedName = entry.name;
      lastSavedAt = entry.updatedAt;
      // Loading is an explicit replacement confirmed by the user.
      clearPending();
      $('#cloudName').value = entry.name;
      status('loaded');
    });
  });
  $('#cloudDelete').addEventListener('click', () => {
    if (busy || !confirm(text('confirmDelete'))) return;
    const entry = entries.find((row) => row.id === $('#cloudSelect').value);
    if (!entry) return;
    return run(async () => {
      await api.delete(entry);
      entries = entries.filter((row) => row.id !== entry.id);
      if (current?.id === entry.id) current = null;
      if (pending?.id === entry.id) clearPending();
      status('deleted');
    });
  });
  $('#languageSelect').addEventListener('change', render);
  $('#cloudName').addEventListener('input', renderSaveState);
  app.onChange?.((event) => {
    if (event.cloud) renderSaveState();
  });
  app.onImport(() => {
    $('#cloudName').value = app.capture().name.slice(0, 200);
    renderSaveState();
  });
  // Imports are still local. Updating this label never uploads or loads data.
  $('#cloudPanel').addEventListener('toggle', () => {
    if ($('#cloudPanel').open && !busy && importId !== app.getImportId())
      $('#cloudName').value = app.capture().name.slice(0, 200);
  });
  render();
  let saved = '';
  try {
    saved = storage.getItem(storageKey) || '';
  } catch {}
  if (validSyncCode(saved)) {
    $('#cloudCode').value = saved;
    void run(() => connect(saved));
  }
  return { render };
}

if (
  studyApp &&
  typeof document !== 'undefined' &&
  document.querySelector('#cloudPanel')
)
  startCloud(studyApp);
