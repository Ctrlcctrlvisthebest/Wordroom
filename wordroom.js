export const FIELDS = ['word', 'meaning', 'example', 'phrase'];
export const OPTIONAL_FIELDS = ['meaning', 'example', 'phrase'];
export const LABELS = {
  word: '单词',
  meaning: '释义',
  example: '例句',
  phrase: '搭配词组',
};
export const SAMPLE_WORDS = [
  {
    word: 'serendipity',
    meaning: '意外发现美好事物的运气',
    example: 'We met by pure serendipity.',
    phrase: 'a stroke of serendipity',
  },
  {
    word: 'resilient',
    meaning: '有韧性的；适应力强的',
    example: 'Children can be remarkably resilient.',
    phrase: 'resilient community',
  },
  {
    word: 'eloquent',
    meaning: '雄辩的；有说服力的',
    example: 'She gave an eloquent speech.',
    phrase: 'eloquent testimony',
  },
  {
    word: 'meticulous',
    meaning: '一丝不苟的；细致的',
    example: 'He kept meticulous records.',
    phrase: 'meticulous attention',
  },
  {
    word: 'wanderlust',
    meaning: '旅行癖；漫游的渴望',
    example: 'The photos awakened her wanderlust.',
    phrase: 'satisfy your wanderlust',
  },
  {
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
  const word = find(['word', '单词', 'vocab']) ?? 0;
  used.add(word);
  return {
    word,
    meaning: find(['meaning', 'definition', '释义', '中文']),
    example: find(['example', 'sentence', '例句']),
    phrase: find(['phrase', 'collocation', '搭配', '词组']),
  };
}

export function createWords(rows, mapping) {
  if (!Number.isInteger(mapping.word)) return [];
  return rows
    .map((row) => ({
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
  const state = {
    words: [...SAMPLE_WORDS],
    deck: shuffled(SAMPLE_WORDS),
    index: 0,
    flipped: false,
    headers: ['word', 'meaning', 'example', 'phrase'],
    rows: SAMPLE_WORDS.map((item) => [
      item.word,
      item.meaning,
      item.example,
      item.phrase,
    ]),
    mapping: { word: 0, meaning: 1, example: 2, phrase: 3 },
  };
  const showMessage = (message = '') => {
    $('#message').textContent = message;
  };
  const isIncluded = (field) =>
    field === 'word' || $(`[data-include="${field}"]`).checked;

  function rebuildDeck() {
    state.words = createWords(state.rows, state.mapping);
    state.deck = shuffled(state.words);
    state.index = 0;
    state.flipped = false;
    $('#count').textContent = state.words.length;
    $('#drawCount').max = Math.max(1, state.words.length);
    $('#drawCount').value =
      clampCount($('#drawCount').value, state.words.length) || 1;
    if (!state.words.length) showMessage('所选“单词”列中没有有效内容');
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
              `<option value="${index}" ${state.mapping[field] === index ? 'selected' : ''} ${used.has(index) ? 'disabled' : ''}>${escapeHTML(header || `第 ${index + 1} 列`)}</option>`,
          )
          .join('');
        return `<div class="field"><label for="map-${field}">${LABELS[field]}${field === 'word' ? ' *' : ''}</label><select id="map-${field}" data-field="${field}">${options}</select></div>`;
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
    if (!current) {
      $('#card').disabled = true;
      $('#card').innerHTML =
        '<span class="muted">请导入包含单词的 CSV 文件</span>';
      return;
    }
    $('#card').disabled = false;
    const fields = OPTIONAL_FIELDS.filter(
      (field) => state.mapping[field] != null && current[field],
    );
    const answer = fields.length
      ? fields
          .map(
            (field) =>
              `<div><b>${LABELS[field]}</b><span>${escapeHTML(current[field])}</span></div>`,
          )
          .join('')
      : '<span class="muted">这个词没有附加内容</span>';
    $('#card').innerHTML =
      `<span class="pill">${state.flipped ? '答案' : '点击翻面'}</span><span class="word">${escapeHTML(current.word)}</span>${state.flipped ? `<span class="answer">${answer}</span>` : '<span class="muted">先在心里回忆，再查看答案</span>'}`;
  }

  function renderDraw() {
    const count = clampCount($('#drawCount').value, state.words.length);
    $('#drawCount').value = count || 1;
    const picked = shuffled(state.words).slice(0, count);
    $('#drawGrid').innerHTML = picked.length
      ? picked
          .map(
            (item, index) =>
              `<article class="item"><h3>${String(index + 1).padStart(2, '0')}　${escapeHTML(item.word)}</h3><label class="sr-only" for="sentence-${index}">用 ${escapeHTML(item.word)} 写例句</label><textarea id="sentence-${index}" placeholder="用 ${escapeHTML(item.word)} 写一个例句…"></textarea></article>`,
          )
          .join('')
      : '<p class="muted">没有可抽取的单词</p>';
  }

  async function loadFile(file) {
    showMessage();
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('文件超过 5 MB，请缩小后重试');
      if (!file.name.toLowerCase().endsWith('.csv'))
        throw new Error('请选择 .csv 文件');
      const parsed = parseCSV(await file.text());
      if (parsed.length < 2) throw new Error('CSV 至少需要一行列名和一行单词');
      state.headers = parsed[0].map(
        (header, index) => header || `第 ${index + 1} 列`,
      );
      state.rows = parsed.slice(1);
      state.mapping = detectMapping(state.headers);
      OPTIONAL_FIELDS.forEach((field) => {
        $(`[data-include="${field}"]`).checked = state.mapping[field] != null;
      });
      $('#filename').textContent = `✓ ${file.name}`;
      renderMapping();
      rebuildDeck();
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : '无法读取这个 CSV 文件',
      );
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
          showMessage('没有剩余的 CSV 列可供映射');
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
  $('#drawBtn').addEventListener('click', renderDraw);
  renderMapping();
  renderCard();
  renderDraw();
}

if (typeof document !== 'undefined' && document.querySelector('#fileInput')) {
  startApp();
}
