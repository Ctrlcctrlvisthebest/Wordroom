import { studyApp, escapeHTML } from './wordroom.js?v=multi1';
import { newSyncCode, validSyncCode } from './cloud-data.js?v=multi1';
import { CloudClient } from './cloud-client.js?v=multi1';
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
    statusError = false;
  const text = (key) =>
    (CLOUD_TEXT[app.getLocale()] || CLOUD_TEXT.zh)[key] ||
    CLOUD_TEXT[app.getLocale()]?.serverError ||
    CLOUD_TEXT.zh.serverError;
  function status(key, error = false) {
    statusKey = key;
    statusError = error;
    $('#cloudStatus').textContent = key ? text(key) : '';
    $('#cloudStatus').dataset.state = error ? 'error' : 'success';
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
    status(statusKey, statusError);
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    status('busy');
    render();
    try {
      await action();
    } catch (error) {
      status(
        Object.hasOwn(CLOUD_TEXT.zh, error?.message)
          ? error.message
          : 'serverError',
        true,
      );
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
    $('#cloudCode').value = code;
    $('#cloudName').value = app.capture().name.slice(0, 200);
    let remembered = false;
    try {
      storage.setItem(storageKey, code);
      remembered = true;
    } catch {}
    status(remembered ? 'connected' : 'connectedTemporary');
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
    $('#cloudCode').value = '';
    status(removed ? 'disconnected' : 'disconnectBlocked', !removed);
    render();
  });
  $('#cloudRefresh').addEventListener('click', () =>
    run(async () => {
      entries = await api.list();
      status('refreshed');
    }),
  );
  $('#cloudSave').addEventListener('click', () =>
    run(async () => {
      const snapshot = app.capture();
      snapshot.name = $('#cloudName').value.trim();
      if (!snapshot.name) throw new Error('nameRequired');
      const changeId = app.getChangeId(),
        sourceId = app.getImportId();
      const target =
        current && importId === sourceId
          ? current
          : { id: crypto.randomUUID(), revision: null };
      const entry = await api.save(target.id, snapshot, target.revision);
      if (app.getImportId() === sourceId) {
        current = entry;
        importId = sourceId;
      }
      entries = [entry, ...entries.filter((row) => row.id !== entry.id)];
      status(changeId === app.getChangeId() ? 'saved' : 'savedEarlier');
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
      status('deleted');
    });
  });
  $('#languageSelect').addEventListener('change', render);
  app.onImport(() => {
    $('#cloudName').value = app.capture().name.slice(0, 200);
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
