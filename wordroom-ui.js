import { studyApp } from './wordroom.js?v=multi1';

const UI_TEXT = {
  zh: {
    label: '界面风格',
    classic: '经典 UI',
    preview: 'P3R 预览',
    loading: '正在加载预览…',
    error: '预览加载失败，请重试。',
  },
  en: {
    label: 'Interface style',
    classic: 'Classic UI',
    preview: 'P3R Preview',
    loading: 'Loading preview…',
    error: 'Preview could not load. Please try again.',
  },
  es: {
    label: 'Estilo de interfaz',
    classic: 'UI clásica',
    preview: 'Vista P3R',
    loading: 'Cargando vista previa…',
    error: 'No se pudo cargar la vista previa. Inténtalo de nuevo.',
  },
};

// Both themes share the same live controls and study state; never reload the app.
export function startUI(app, doc = globalThis.document) {
  const $ = (id) => doc?.querySelector(`#${id}`);
  const select = $('uiSelect');
  if (!select || !app) return;

  let active = 'classic';
  let previewSheet = null;
  let busy = false;
  let status = '';
  const classicSheet = $('classicTheme');
  const nav = $('practiceNav');

  function renderLabels() {
    const text = UI_TEXT[app.getLocale()] || UI_TEXT.zh;
    $('uiLabel').textContent = text.label;
    $('classicUIOption').textContent = text.classic;
    $('previewUIOption').textContent = text.preview;
    $('uiStatus').textContent = text[status] || '';
    $('uiStatus').hidden = !status;
  }

  function loadPreview() {
    if (previewSheet) return Promise.resolve(true);
    // Fetch only on demand; keep the working classic theme until CSS is ready.
    return new Promise((resolve) => {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.media = 'not all';
      link.href = new URL('./wordroom-p3r.css?v=2', import.meta.url).href;
      const timeout = setTimeout(() => finish(false), 15000);
      function finish(success) {
        clearTimeout(timeout);
        link.onload = link.onerror = null;
        if (success) previewSheet = link;
        else link.remove();
        resolve(success);
      }
      link.onload = () => finish(true);
      link.onerror = () => finish(false);
      // Preserve the shared feedback/cloud overrides after the active theme.
      doc.head.insertBefore(link, classicSheet);
    });
  }

  function applyTheme(theme) {
    const preview = theme === 'p3r';
    classicSheet.media = preview ? 'not all' : 'all';
    if (previewSheet) previewSheet.media = preview ? 'all' : 'not all';
    const parent = $(preview ? 'sidebar' : 'siteHeader');
    parent.insertBefore(nav, $(preview ? 'libraryPanel' : 'editionMark'));
    doc.body.dataset.ui = theme;
    doc
      .querySelector('meta[name="theme-color"]')
      .setAttribute('content', preview ? '#0758ee' : '#243550');
    active = select.value = theme;
  }

  select.addEventListener('change', async () => {
    if (busy) return;
    const theme = select.value;
    if (theme !== 'classic' && theme !== 'p3r') {
      select.value = active;
      return;
    }
    status = '';
    if (theme === 'p3r') {
      const restoreFocus = doc.activeElement === select;
      busy = select.disabled = true;
      status = 'loading';
      renderLabels();
      const loaded = await loadPreview();
      busy = select.disabled = false;
      if (
        restoreFocus &&
        (!doc.activeElement || doc.activeElement === doc.body)
      )
        select.focus();
      status = loaded ? '' : 'error';
      if (!loaded) {
        select.value = active;
        renderLabels();
        return;
      }
    }
    applyTheme(theme);
    renderLabels();
  });
  $('languageSelect').addEventListener('change', renderLabels);
  // Deliberately default to the published classic UI on each new page load.
  applyTheme('classic');
  renderLabels();
}

startUI(studyApp);
