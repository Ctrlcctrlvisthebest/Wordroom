// Reuse the existing buttons so mouse and keyboard share the same card state.
export function startShortcuts(doc = globalThis.document) {
  if (!doc) return;
  const $ = (id) => doc.querySelector(`#${id}`);
  const card = $('card');
  if (!card) return;
  const star = $('cardStar');
  const actions = new Map([
    ['ArrowLeft', $('prev')],
    ['ArrowRight', $('next')],
    [' ', $('flip')],
    ['s', star],
  ]);
  const studyControls = new Set([card, $('prev'), $('next'), $('flip')]);
  const nativeControls = new Set([
    'INPUT',
    'TEXTAREA',
    'SELECT',
    'BUTTON',
    'A',
    'SUMMARY',
    'AUDIO',
    'VIDEO',
  ]);
  function isProtected(node) {
    return (
      node?.isContentEditable ||
      node === $('musicWidget') ||
      (nativeControls.has(node?.tagName) && !studyControls.has(node)) ||
      ['textbox', 'combobox', 'slider', 'listbox', 'spinbutton'].includes(
        node?.getAttribute?.('role'),
      )
    );
  }
  doc.addEventListener('keydown', (event) => {
    const button = actions.get(
      event.key?.length === 1 ? event.key.toLowerCase() : event.key,
    );
    if (
      !button ||
      event.defaultPrevented ||
      event.isComposing ||
      // oxlint-disable-next-line typescript/no-deprecated -- Retain the legacy IME guard alongside isComposing.
      event.keyCode === 229 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      $('cardsView').classList.contains('hide') ||
      card.disabled
    )
      return;
    const path = event.composedPath?.() || [];
    const protectedForKey = (node) =>
      node === star && button === star ? false : isProtected(node);
    for (
      let node = event.target || doc.activeElement;
      node;
      node = node.parentNode
    )
      if (protectedForKey(node)) return;
    if (path.some(protectedForKey)) return;
    // Prevent scrolling and the focused study button's native space-click.
    // Holding a key never skips many words or repeatedly flips the card.
    event.preventDefault();
    if (!event.repeat && !button.disabled) button.click();
  });
  $('prev').setAttribute('aria-keyshortcuts', 'ArrowLeft');
  $('next').setAttribute('aria-keyshortcuts', 'ArrowRight');
  $('flip').setAttribute('aria-keyshortcuts', 'Space');
  card.setAttribute('aria-keyshortcuts', 'Space');
  star.setAttribute('aria-keyshortcuts', 's');
  function renderHint() {
    const hints = {
      zh: '点击卡片或空格翻面 · ← 上一个 · → 下一个 · S 星标',
      en: 'Click or Space to flip · ← Previous · → Next · S Star',
      es: 'Clic o Espacio para voltear · ← Anterior · → Siguiente · S Favorita',
    };
    $('cardFooter').textContent = hints[$('languageSelect').value] || hints.zh;
  }
  $('languageSelect').addEventListener('change', renderHint);
  renderHint();
}

startShortcuts();
