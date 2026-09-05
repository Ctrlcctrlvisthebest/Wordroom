export const FIELDS = ['word', 'meaning', 'example', 'phrase'];
export const OPTIONAL_FIELDS = ['meaning', 'example', 'phrase'];
export const LABELS = {
  word: '单词',
  meaning: '释义',
  example: '例句',
  phrase: '搭配词组',
};
export const SUPPORTED_LOCALES = ['zh', 'en', 'es'];
export const TRANSLATIONS = {
  zh: {
    language: '语言',
    brandName: '词间 · Wordroom',
    brandTagline: '把你的词表，变成今天的练习',
    siteDescription: '导入 CSV 词表，随机翻卡与抽词造句。',
    wordCount: '{count} 个单词',
    exportStarred: '导出星标（{count}）',
    importList: '导入词表',
    dropTitle: '拖入 CSV 文件',
    dropHint: '或点击选择 · 首行为列名 · 最大 5 MB',
    sampleFile: '示例词库.csv',
    loaded: '已载入',
    csvContents: 'CSV 里有什么？',
    mappingHint: '勾选文件包含的内容，再指定对应列。单词为必选。',
    required: '必选',
    field_word: '单词',
    field_meaning: '释义',
    field_example: '例句',
    field_phrase: '搭配词组',
    column: '第 {number} 列',
    cards: '随机卡片',
    drawPractice: '抽词练习',
    shuffle: '重新洗牌',
    todayReview: '今日复习',
    answer: '答案',
    clickFlip: '点击翻面',
    rememberFirst: '先在心里回忆，再查看答案',
    noExtra: '这个词没有附加内容',
    importWords: '请导入包含单词的 CSV 文件',
    previous: '上一个',
    flip: '翻面',
    next: '下一个',
    cardFooter: '点击卡片翻面 · 每次洗牌都会生成新的顺序',
    drawTitle: '随机抽取一组词',
    drawHint: '不看答案，试着为每个词写一个自己的例句。',
    drawLabel: '抽取',
    wordsUnit: '个词',
    redraw: '重新抽取',
    sentencePlaceholder: '用 {word} 写一个例句…',
    sentenceAria: '用 {word} 写例句',
    noDrawable: '没有可抽取的单词',
    noWordsLoaded: '请先导入词表',
    addStar: '给 {word} 加星标',
    removeStar: '取消 {word} 的星标',
    noCurrentStar: '当前没有可星标的单词',
    exportAria: '导出 {count} 个星标单词',
    starredSuffix: '-星标',
    autoImported: '自动导入的词表',
    errorTooLarge: '文件超过 5 MB，请缩小后重试',
    errorWrongType: '请选择 .csv 文件',
    errorTooFewRows: 'CSV 至少需要一行列名和一行单词',
    errorUnclosedQuote: 'CSV 中有未闭合的引号',
    errorNoWords: '所选“单词”列中没有有效内容',
    errorNoColumn: '没有剩余的 CSV 列可供映射',
    errorRead: '无法读取这个 CSV 文件',
  },
  en: {
    language: 'Language',
    brandName: 'Wordroom',
    brandTagline: "Turn your word list into today's practice",
    siteDescription:
      'Import a CSV word list, study with random cards, and practice writing sentences.',
    wordCount: '{count} words',
    exportStarred: 'Export starred ({count})',
    importList: 'Import word list',
    dropTitle: 'Drop a CSV file here',
    dropHint: 'or click to choose · first row is headers · 5 MB max',
    sampleFile: 'Sample vocabulary.csv',
    loaded: 'Loaded',
    csvContents: "What's in the CSV?",
    mappingHint:
      'Select the included content, then assign each column. Word is required.',
    required: 'required',
    field_word: 'Word',
    field_meaning: 'Meaning',
    field_example: 'Example',
    field_phrase: 'Collocation',
    column: 'Column {number}',
    cards: 'Random cards',
    drawPractice: 'Writing practice',
    shuffle: 'Shuffle again',
    todayReview: "Today's review",
    answer: 'Answer',
    clickFlip: 'Click to flip',
    rememberFirst: 'Try to remember it before checking the answer',
    noExtra: 'This word has no additional content',
    importWords: 'Import a CSV file containing words',
    previous: 'Previous',
    flip: 'Flip',
    next: 'Next',
    cardFooter: 'Click a card to flip · each shuffle creates a new order',
    drawTitle: 'Draw a random set of words',
    drawHint:
      'Without looking at the answers, write your own sentence for each word.',
    drawLabel: 'Draw',
    wordsUnit: 'words',
    redraw: 'Draw again',
    sentencePlaceholder: 'Write a sentence with {word}…',
    sentenceAria: 'Write a sentence with {word}',
    noDrawable: 'No words available to draw',
    noWordsLoaded: 'Import a word list first',
    addStar: 'Star {word}',
    removeStar: 'Remove the star from {word}',
    noCurrentStar: 'There is no word to star',
    exportAria: 'Export {count} starred words',
    starredSuffix: '-starred',
    autoImported: 'Automatically imported word list',
    errorTooLarge: 'The file is larger than 5 MB. Choose a smaller file.',
    errorWrongType: 'Choose a .csv file',
    errorTooFewRows: 'The CSV needs a header row and at least one word row',
    errorUnclosedQuote: 'The CSV contains an unclosed quote',
    errorNoWords: 'The selected Word column has no valid entries',
    errorNoColumn: 'No unused CSV column is available for this field',
    errorRead: 'This CSV file could not be read',
  },
  es: {
    language: 'Idioma',
    brandName: 'Wordroom',
    brandTagline: 'Convierte tu lista en la práctica de hoy',
    siteDescription:
      'Importa una lista CSV, repasa con tarjetas aleatorias y practica escribiendo oraciones.',
    wordCount: '{count} palabras',
    exportStarred: 'Exportar favoritas ({count})',
    importList: 'Importar lista de palabras',
    dropTitle: 'Suelta aquí un archivo CSV',
    dropHint:
      'o haz clic para elegir · primera fila: encabezados · máximo 5 MB',
    sampleFile: 'Vocabulario de ejemplo.csv',
    loaded: 'Cargado',
    csvContents: '¿Qué contiene el CSV?',
    mappingHint:
      'Marca el contenido incluido y asigna cada columna. La palabra es obligatoria.',
    required: 'obligatoria',
    field_word: 'Palabra',
    field_meaning: 'Significado',
    field_example: 'Ejemplo',
    field_phrase: 'Colocación',
    column: 'Columna {number}',
    cards: 'Tarjetas aleatorias',
    drawPractice: 'Práctica de escritura',
    shuffle: 'Barajar de nuevo',
    todayReview: 'Repaso de hoy',
    answer: 'Respuesta',
    clickFlip: 'Haz clic para voltear',
    rememberFirst: 'Intenta recordarla antes de ver la respuesta',
    noExtra: 'Esta palabra no tiene contenido adicional',
    importWords: 'Importa un archivo CSV que contenga palabras',
    previous: 'Anterior',
    flip: 'Voltear',
    next: 'Siguiente',
    cardFooter:
      'Haz clic en la tarjeta para voltearla · cada mezcla crea un orden nuevo',
    drawTitle: 'Extrae un grupo de palabras al azar',
    drawHint:
      'Sin mirar las respuestas, escribe una oración propia para cada palabra.',
    drawLabel: 'Extraer',
    wordsUnit: 'palabras',
    redraw: 'Extraer de nuevo',
    sentencePlaceholder: 'Escribe una oración con {word}…',
    sentenceAria: 'Escribe una oración con {word}',
    noDrawable: 'No hay palabras disponibles',
    noWordsLoaded: 'Importa primero una lista de palabras',
    addStar: 'Añadir {word} a favoritas',
    removeStar: 'Quitar {word} de favoritas',
    noCurrentStar: 'No hay ninguna palabra para marcar',
    exportAria: 'Exportar {count} palabras favoritas',
    starredSuffix: '-favoritas',
    autoImported: 'Lista de palabras importada automáticamente',
    errorTooLarge: 'El archivo supera los 5 MB. Elige uno más pequeño.',
    errorWrongType: 'Elige un archivo .csv',
    errorTooFewRows:
      'El CSV necesita una fila de encabezados y al menos una fila de palabras',
    errorUnclosedQuote: 'El CSV contiene comillas sin cerrar',
    errorNoWords: 'La columna Palabra seleccionada no contiene valores válidos',
    errorNoColumn:
      'No queda ninguna columna del CSV disponible para este campo',
    errorRead: 'No se pudo leer este archivo CSV',
  },
};

export function translate(locale, key, variables = {}) {
  const dictionary = TRANSLATIONS[locale] ?? TRANSLATIONS.zh;
  const template = dictionary[key] ?? TRANSLATIONS.zh[key] ?? key;
  return Object.entries(variables).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
export const SAMPLE_WORDS = [
  {
    sourceIndex: 0,
    word: 'serendipity',
    meaning: '意外发现美好事物的运气',
    example: 'We met by pure serendipity.',
    phrase: 'a stroke of serendipity',
  },
  {
    sourceIndex: 1,
    word: 'resilient',
    meaning: '有韧性的；适应力强的',
    example: 'Children can be remarkably resilient.',
    phrase: 'resilient community',
  },
  {
    sourceIndex: 2,
    word: 'eloquent',
    meaning: '雄辩的；有说服力的',
    example: 'She gave an eloquent speech.',
    phrase: 'eloquent testimony',
  },
  {
    sourceIndex: 3,
    word: 'meticulous',
    meaning: '一丝不苟的；细致的',
    example: 'He kept meticulous records.',
    phrase: 'meticulous attention',
  },
  {
    sourceIndex: 4,
    word: 'wanderlust',
    meaning: '旅行癖；漫游的渴望',
    example: 'The photos awakened her wanderlust.',
    phrase: 'satisfy your wanderlust',
  },
  {
    sourceIndex: 5,
    word: 'pragmatic',
    meaning: '务实的；讲求实际的',
    example: 'We need a pragmatic solution.',
    phrase: 'pragmatic approach',
  },
];

export function parseCSV(text) {
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [],
    cell = '',
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('CSV 中有未闭合的引号');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function detectMapping(headers) {
  const lower = headers.map((value) => String(value).trim().toLowerCase());
  const used = new Set();
  const find = (names) => {
    const index = lower.findIndex(
      (header, candidate) =>
        !used.has(candidate) && names.some((name) => header.includes(name)),
    );
    if (index >= 0) used.add(index);
    return index < 0 ? null : index;
  };
  const word = find(['word', '单词', 'vocab', 'palabra']) ?? 0;
  used.add(word);
  return {
    word,
    meaning: find([
      'meaning',
      'definition',
      '释义',
      '中文',
      'significado',
      'definición',
      'definicion',
    ]),
    example: find(['example', 'sentence', '例句', 'ejemplo', 'oración']),
    phrase: find([
      'phrase',
      'collocation',
      '搭配',
      '词组',
      'frase',
      'colocación',
      'colocacion',
    ]),
  };
}

export function createWords(rows, mapping) {
  if (!Number.isInteger(mapping.word)) return [];
  return rows
    .map((row, sourceIndex) => ({
      sourceIndex,
      word: String(row[mapping.word] ?? '').trim(),
      meaning:
        mapping.meaning == null
          ? ''
          : String(row[mapping.meaning] ?? '').trim(),
      example:
        mapping.example == null
          ? ''
          : String(row[mapping.example] ?? '').trim(),
      phrase:
        mapping.phrase == null ? '' : String(row[mapping.phrase] ?? '').trim(),
    }))
    .filter((item) => item.word);
}

export function serializeCSV(rows) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const cell = String(value ?? '');
          return /[",\r\n]/.test(cell)
            ? `"${cell.replaceAll('"', '""')}"`
            : cell;
        })
        .join(','),
    )
    .join('\r\n');
}

export function createStarredCSV(headers, rows, sourceIndices) {
  const selectedRows = [...new Set(sourceIndices)]
    .filter(
      (index) => Number.isInteger(index) && index >= 0 && index < rows.length,
    )
    .sort((a, b) => a - b)
    .map((index) => rows[index]);
  return serializeCSV([headers, ...selectedRows]);
}

export function shuffled(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
export function clampCount(value, total) {
  if (total < 1) return 0;
  const parsed = Number.parseInt(String(value), 10);
  return Math.min(total, Math.max(1, Number.isFinite(parsed) ? parsed : 1));
}
export function escapeHTML(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ],
  );
}

function startApp() {
  const $ = (selector) => document.querySelector(selector);
  const savedLocale = (() => {
    try {
      const value = localStorage.getItem('wordroom-language');
      return SUPPORTED_LOCALES.includes(value) ? value : 'zh';
    } catch {
      return 'zh';
    }
  })();
  const state = {
    words: [...SAMPLE_WORDS],
    deck: shuffled(SAMPLE_WORDS),
    drawn: shuffled(SAMPLE_WORDS).slice(0, 3),
    starred: new Set(),
    answers: new Map(),
    index: 0,
    flipped: false,
    headers: ['word', 'meaning', 'example', 'phrase'],
    sourceHeaders: ['word', 'meaning', 'example', 'phrase'],
    fileName: '示例词库.csv',
    rows: SAMPLE_WORDS.map((item) => [
      item.word,
      item.meaning,
      item.example,
      item.phrase,
    ]),
    mapping: { word: 0, meaning: 1, example: 2, phrase: 3 },
    locale: savedLocale,
    messageKey: '',
    isSample: true,
  };
  const t = (key, variables) => translate(state.locale, key, variables);
  const showMessage = (key = '') => {
    state.messageKey = key;
    $('#message').textContent = key ? t(key) : '';
  };
  const isIncluded = (field) =>
    field === 'word' || $(`[data-include="${field}"]`).checked;

  function updateExportButton() {
    const count = state.starred.size;
    $('#exportBtn').disabled = count === 0;
    $('#exportBtn').textContent = `↓ ${t('exportStarred', { count })}`;
    $('#exportBtn').setAttribute('aria-label', t('exportAria', { count }));
  }

  function applyLanguage() {
    const localeNames = { zh: 'zh-CN', en: 'en', es: 'es' };
    document.documentElement.lang = localeNames[state.locale];
    document.title = t('brandName');
    document.querySelector('meta[name="description"]').content =
      t('siteDescription');
    $('#languageSelect').value = state.locale;
    $('#languageSelect').setAttribute('aria-label', t('language'));
    document.querySelector('label[for="languageSelect"]').textContent =
      t('language');
    $('#brandName').textContent = t('brandName');
    $('#brandTagline').textContent = t('brandTagline');
    $('#importTitle').textContent = `▣ ${t('importList')}`;
    $('#dropTitle').textContent = t('dropTitle');
    $('#dropHint').textContent = t('dropHint');
    $('#csvContents').textContent = t('csvContents');
    $('#mappingHint').textContent = t('mappingHint');
    $('#requiredWord').textContent = `${t('field_word')} (${t('required')})`;
    document.querySelectorAll('[data-field-label]').forEach((label) => {
      label.textContent = t(`field_${label.dataset.fieldLabel}`);
    });
    $('#cardsTabLabel').textContent = t('cards');
    $('#drawTabLabel').textContent = t('drawPractice');
    $('#shuffleLabel').textContent = t('shuffle');
    $('#reviewLabel').textContent = t('todayReview');
    $('#prev').textContent = `← ${t('previous')}`;
    $('#flip').textContent = `↻ ${t('flip')}`;
    $('#next').textContent = `${t('next')} →`;
    $('#cardFooter').textContent = t('cardFooter');
    $('#drawTitle').textContent = t('drawTitle');
    $('#drawHint').textContent = t('drawHint');
    $('#drawLabel').textContent = t('drawLabel');
    $('#drawUnit').textContent = t('wordsUnit');
    $('#redrawLabel').textContent = t('redraw');
    if (state.isSample) $('#filename').textContent = `✓ ${t('sampleFile')}`;
    if (state.messageKey) $('#message').textContent = t(state.messageKey);
    $('#count').textContent = t('wordCount', { count: state.words.length });
    updateExportButton();
    renderMapping();
    renderCard();
    renderDraw();
  }

  function toggleStar(sourceIndex) {
    if (state.starred.has(sourceIndex)) state.starred.delete(sourceIndex);
    else state.starred.add(sourceIndex);
    updateExportButton();
    renderCard();
    renderDraw();
  }

  function exportStarred() {
    if (!state.starred.size) return;
    const csv = createStarredCSV(
      state.sourceHeaders,
      state.rows,
      state.starred,
    );
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const displayFileName = state.isSample ? t('sampleFile') : state.fileName;
    const baseName = displayFileName.replace(/\.csv$/i, '') || 'wordroom';
    link.href = url;
    link.download = `${baseName}${t('starredSuffix')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function rebuildDeck() {
    state.words = createWords(state.rows, state.mapping);
    const validSourceIndices = new Set(
      state.words.map((item) => item.sourceIndex),
    );
    state.starred = new Set(
      [...state.starred].filter((sourceIndex) =>
        validSourceIndices.has(sourceIndex),
      ),
    );
    state.deck = shuffled(state.words);
    state.index = 0;
    state.flipped = false;
    $('#count').textContent = t('wordCount', { count: state.words.length });
    $('#drawCount').max = Math.max(1, state.words.length);
    $('#drawCount').value =
      clampCount($('#drawCount').value, state.words.length) || 1;
    state.drawn = shuffled(state.words).slice(
      0,
      clampCount($('#drawCount').value, state.words.length),
    );
    state.answers.clear();
    if (!state.words.length) showMessage('errorNoWords');
    updateExportButton();
    renderCard();
    renderDraw();
  }

  function renderMapping() {
    const activeFields = FIELDS.filter(isIncluded);
    $('#mapping').innerHTML = activeFields
      .map((field) => {
        const used = new Set(
          activeFields
            .filter((other) => other !== field)
            .map((other) => state.mapping[other])
            .filter(Number.isInteger),
        );
        const options = state.headers
          .map(
            (header, index) =>
              `<option value="${index}" ${state.mapping[field] === index ? 'selected' : ''} ${used.has(index) ? 'disabled' : ''}>${escapeHTML(header || t('column', { number: index + 1 }))}</option>`,
          )
          .join('');
        return `<div class="field"><label for="map-${field}">${t(`field_${field}`)}${field === 'word' ? ' *' : ''}</label><select id="map-${field}" data-field="${field}">${options}</select></div>`;
      })
      .join('');
    document.querySelectorAll('[data-field]').forEach((select) =>
      select.addEventListener('change', () => {
        state.mapping[select.dataset.field] = Number(select.value);
        showMessage();
        renderMapping();
        rebuildDeck();
      }),
    );
  }

  function renderCard() {
    const current = state.deck[state.index];
    $('#position').textContent = state.deck.length
      ? `${state.index + 1} / ${state.deck.length}`
      : '0 / 0';
    $('#progress').style.width = state.deck.length
      ? `${((state.index + 1) / state.deck.length) * 100}%`
      : '0%';
    $('#prev').disabled = state.index <= 0;
    $('#next').disabled = state.index >= state.deck.length - 1;
    $('#flip').disabled = !current;
    $('#cardStar').disabled = !current;
    if (!current) {
      $('#cardStar').textContent = '☆';
      $('#cardStar').classList.remove('active');
      $('#cardStar').setAttribute('aria-pressed', 'false');
      $('#cardStar').setAttribute('aria-label', t('noCurrentStar'));
      $('#card').disabled = true;
      $('#card').innerHTML = `<span class="muted">${t('importWords')}</span>`;
      return;
    }
    $('#card').disabled = false;
    const isStarred = state.starred.has(current.sourceIndex);
    $('#cardStar').textContent = isStarred ? '★' : '☆';
    $('#cardStar').classList.toggle('active', isStarred);
    $('#cardStar').setAttribute('aria-pressed', String(isStarred));
    $('#cardStar').setAttribute(
      'aria-label',
      t(isStarred ? 'removeStar' : 'addStar', { word: current.word }),
    );
    const fields = OPTIONAL_FIELDS.filter(
      (field) => state.mapping[field] != null && current[field],
    );
    const answer = fields.length
      ? fields
          .map(
            (field) =>
              `<div><b>${t(`field_${field}`)}</b><span>${escapeHTML(current[field])}</span></div>`,
          )
          .join('')
      : `<span class="muted">${t('noExtra')}</span>`;
    $('#card').innerHTML =
      `<span class="pill">${t(state.flipped ? 'answer' : 'clickFlip')}</span><span class="word">${escapeHTML(current.word)}</span>${state.flipped ? `<span class="answer">${answer}</span>` : `<span class="muted">${t('rememberFirst')}</span>`}`;
  }

  function renderDraw() {
    $('#drawGrid').innerHTML = state.drawn.length
      ? state.drawn
          .map(
            (item, index) =>
              `<article class="item"><div class="item-title"><h3>${String(index + 1).padStart(2, '0')}　${escapeHTML(item.word)}</h3><button class="star-btn ${state.starred.has(item.sourceIndex) ? 'active' : ''}" type="button" data-star="${item.sourceIndex}" aria-pressed="${state.starred.has(item.sourceIndex)}" aria-label="${escapeHTML(t(state.starred.has(item.sourceIndex) ? 'removeStar' : 'addStar', { word: item.word }))}">${state.starred.has(item.sourceIndex) ? '★' : '☆'}</button></div><label class="sr-only" for="sentence-${index}">${escapeHTML(t('sentenceAria', { word: item.word }))}</label><textarea id="sentence-${index}" data-answer="${item.sourceIndex}" placeholder="${escapeHTML(t('sentencePlaceholder', { word: item.word }))}">${escapeHTML(state.answers.get(item.sourceIndex) || '')}</textarea></article>`,
          )
          .join('')
      : `<p class="muted">${t('noDrawable')}</p>`;
    document.querySelectorAll('[data-star]').forEach((button) =>
      button.addEventListener('click', () => {
        toggleStar(Number(button.dataset.star));
      }),
    );
    document.querySelectorAll('[data-answer]').forEach((textarea) =>
      textarea.addEventListener('input', () => {
        state.answers.set(Number(textarea.dataset.answer), textarea.value);
      }),
    );
  }

  function drawWords() {
    const count = clampCount($('#drawCount').value, state.words.length);
    $('#drawCount').value = count || 1;
    state.drawn = shuffled(state.words).slice(0, count);
    state.answers.clear();
    renderDraw();
  }

  async function loadFile(file) {
    showMessage();
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('errorTooLarge');
      if (!file.name.toLowerCase().endsWith('.csv'))
        throw new Error('errorWrongType');
      const parsed = parseCSV(await file.text());
      if (parsed.length < 2) throw new Error('errorTooFewRows');
      state.sourceHeaders = parsed[0];
      state.headers = parsed[0];
      state.rows = parsed.slice(1);
      state.fileName = file.name;
      state.isSample = false;
      state.starred.clear();
      state.answers.clear();
      state.mapping = detectMapping(state.headers);
      OPTIONAL_FIELDS.forEach((field) => {
        $(`[data-include="${field}"]`).checked = state.mapping[field] != null;
      });
      $('#filename').textContent = `✓ ${file.name}`;
      updateExportButton();
      renderMapping();
      rebuildDeck();
    } catch (error) {
      const errorKey =
        error instanceof Error && error.message === 'CSV 中有未闭合的引号'
          ? 'errorUnclosedQuote'
          : error instanceof Error && error.message.startsWith('error')
            ? error.message
            : 'errorRead';
      showMessage(errorKey);
    } finally {
      $('#fileInput').value = '';
    }
  }

  $('#drop').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', (event) => {
    void loadFile(event.target.files?.[0]);
  });
  $('#drop').addEventListener('dragover', (event) => {
    event.preventDefault();
    $('#drop').classList.add('drag');
  });
  $('#drop').addEventListener('dragleave', () =>
    $('#drop').classList.remove('drag'),
  );
  $('#drop').addEventListener('drop', (event) => {
    event.preventDefault();
    $('#drop').classList.remove('drag');
    void loadFile(event.dataTransfer.files?.[0]);
  });
  const flip = () => {
    if (state.deck[state.index]) {
      state.flipped = !state.flipped;
      renderCard();
    }
  };
  $('#card').addEventListener('click', flip);
  $('#flip').addEventListener('click', flip);
  $('#cardStar').addEventListener('click', () => {
    const current = state.deck[state.index];
    if (current) toggleStar(current.sourceIndex);
  });
  $('#exportBtn').addEventListener('click', exportStarred);
  $('#languageSelect').addEventListener('change', (event) => {
    const locale = event.target.value;
    if (!SUPPORTED_LOCALES.includes(locale)) return;
    state.locale = locale;
    try {
      localStorage.setItem('wordroom-language', locale);
    } catch {}
    applyLanguage();
  });
  $('#prev').addEventListener('click', () => {
    state.index = Math.max(0, state.index - 1);
    state.flipped = false;
    renderCard();
  });
  $('#next').addEventListener('click', () => {
    state.index = Math.min(state.deck.length - 1, state.index + 1);
    state.flipped = false;
    renderCard();
  });
  $('#shuffleBtn').addEventListener('click', () => {
    state.deck = shuffled(state.words);
    state.index = 0;
    state.flipped = false;
    renderCard();
  });
  document.querySelectorAll('[data-include]').forEach((checkbox) =>
    checkbox.addEventListener('change', () => {
      const field = checkbox.dataset.include;
      if (!checkbox.checked) state.mapping[field] = null;
      else {
        const used = new Set(
          Object.values(state.mapping).filter(Number.isInteger),
        );
        const available = state.headers.findIndex(
          (_, index) => !used.has(index),
        );
        if (available < 0) {
          checkbox.checked = false;
          showMessage('errorNoColumn');
        } else {
          state.mapping[field] = available;
          showMessage();
        }
      }
      renderMapping();
      rebuildDeck();
    }),
  );
  function switchView(view) {
    const cards = view === 'cards';
    $('#cardsView').classList.toggle('hide', !cards);
    $('#drawView').classList.toggle('hide', cards);
    $('#cardsTab').classList.toggle('active', cards);
    $('#drawTab').classList.toggle('active', !cards);
    $('#shuffleBtn').classList.toggle('hide', !cards);
    if (!cards) renderDraw();
  }
  $('#cardsTab').addEventListener('click', () => switchView('cards'));
  $('#drawTab').addEventListener('click', () => switchView('draw'));
  $('#drawCount').addEventListener('change', () => {
    $('#drawCount').value =
      clampCount($('#drawCount').value, state.words.length) || 1;
  });
  $('#drawBtn').addEventListener('click', drawWords);
  applyLanguage();
}

if (typeof document !== 'undefined' && document.querySelector('#fileInput')) {
  startApp();
}
