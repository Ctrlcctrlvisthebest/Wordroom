// Optional real-browser smoke test. Uses an isolated temporary browser context,
// synthetic CSVs and blocks production cloud requests. No personal browser state.
// PLAYWRIGHT_MODULE=file:///path/to/playwright/index.mjs CHROME_EXECUTABLE=/path/to/chrome node scripts/smoke-preview.mjs
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const base = process.env.WORDROOM_PREVIEW_URL || 'http://127.0.0.1:4174/';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw new Error('Smoke tests only allow local preview URLs');
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROME_EXECUTABLE
    ? { executablePath: process.env.CHROME_EXECUTABLE }
    : {}),
  args: ['--mute-audio'],
});
const errors = [],
  audioRequests = [];
let cloudRequests = 0;
const files = [
  {
    name: 'one.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'word,meaning,联想\nalpha,第一,第一个字母\nbeta,第二,第二个字母',
    ),
  },
  {
    name: 'two.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('word,meaning\ngamma,第三\ndelta,第四'),
  },
];
const waitSaved = (page) =>
  page
    .locator('#localStatus')
    .filter({
      hasText: /本机已保存|Saved on this device|Guardado en este dispositivo/,
    })
    .waitFor();
const waitRestored = (page) =>
  page
    .locator('#localStatus')
    .filter({
      hasText: /已恢复|Previous session restored|Sesión anterior restaurada/,
    })
    .waitFor();
async function setup(context) {
  // Never touch production cloud data, including if code changes add auto-connect.
  await context.route('**/*.workers.dev/**', (route) => {
    cloudRequests++;
    return route.abort();
  });
  context.on('page', (page) => {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.url().includes('.m4a')) audioRequests.push(request.url());
    });
  });
}
try {
  await mkdir(new URL('../outputs/', import.meta.url), { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1360, height: 920 },
    reducedMotion: 'reduce',
  });
  await setup(context);
  const page = await context.newPage();
  await page.goto(base);
  await page
    .locator('#localStatus')
    .filter({ hasText: '开始练习后自动保存' })
    .waitFor();
  await page.locator('#fileInput').setInputFiles(files);
  await page.locator('#count').filter({ hasText: '4 个单词' }).waitFor();
  await page.locator('#reviewSource').selectOption('0');
  assert.equal(
    await page.locator('#reviewCount').textContent(),
    '本次范围：2 个词',
  );
  await page.locator('#card').focus();
  await page.keyboard.press('s');
  await page.locator('#reviewSource').selectOption('all');
  await page.locator('#reviewStarred').check();
  assert.equal(
    await page.locator('#reviewCount').textContent(),
    '本次范围：1 个词',
  );
  await page.locator('#drawTab').click();
  await page
    .locator('[data-answer]')
    .fill('My sentence survives a real browser reload.');
  await waitSaved(page);
  assert.equal(await page.locator('#localRetry').isVisible(), false);
  await page.reload();
  await waitRestored(page);
  assert.equal(
    await page.locator('[data-answer]').inputValue(),
    'My sentence survives a real browser reload.',
  );
  assert.equal(await page.locator('#reviewStarred').isChecked(), true);
  await page.locator('#cardsTab').click();
  await page.locator('#card').click();
  await page.locator('#card').filter({ hasText: '联想' }).waitFor();
  await waitSaved(page);
  await page.screenshot({
    path: new URL('../outputs/preview-classic-desktop.png', import.meta.url)
      .pathname,
    fullPage: true,
  });
  await page.locator('#uiSelect').selectOption('p3r');
  await page.waitForFunction(() => document.body.dataset.ui === 'p3r');
  await page.locator('#languageSelect').selectOption('es');
  assert.equal(
    await page.locator('#reviewStarredLabel').textContent(),
    'Solo favoritas',
  );
  await waitSaved(page);
  await page.screenshot({
    path: new URL('../outputs/preview-p3r-desktop.png', import.meta.url)
      .pathname,
    fullPage: true,
  });
  const second = await context.newPage();
  await second.goto(base);
  await waitRestored(second);
  await page.locator('#flip').click();
  await waitSaved(page);
  await second.locator('#flip').click();
  await second
    .locator('#localStatus')
    .filter({ hasText: 'Otra pestaña' })
    .waitFor();
  await second.close();
  assert.equal(
    audioRequests.length,
    0,
    'no audio requests before an explicit music action',
  );
  await page.locator('#musicToggle').click();
  await page.locator('#musicPlay').click();
  await page.waitForFunction(
    () => document.querySelector('#studyMusic').currentTime > 0.1,
    undefined,
    { timeout: 15000 },
  );
  await page.locator('#musicPlay').click();
  assert(
    audioRequests.some((url) => url.includes('study-continuous-a44917c233bd')),
  );
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  await setup(mobile);
  const phone = await mobile.newPage();
  await phone.goto(base);
  await phone
    .locator('#localStatus')
    .filter({ hasText: '开始练习后自动保存' })
    .waitFor({ state: 'attached' });
  assert.equal(await phone.locator('#libraryPanel').getAttribute('open'), null);
  await phone.locator('#fileInput').setInputFiles(files);
  await phone.locator('#reviewStarred').check();
  assert.equal(await phone.locator('#card').isDisabled(), true);
  await phone.locator('#reviewStarred').uncheck();
  await phone.locator('#languageSelect').selectOption('en');
  assert.equal(
    await phone.locator('#reviewScopeLabel').textContent(),
    'Review scope',
  );
  assert(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'classic mobile no horizontal overflow',
  );
  await phone.screenshot({
    path: new URL('../outputs/preview-classic-mobile.png', import.meta.url)
      .pathname,
    fullPage: true,
  });
  await phone.locator('#uiSelect').selectOption('p3r');
  await phone.waitForFunction(() => document.body.dataset.ui === 'p3r');
  assert(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    'P3R mobile no horizontal overflow',
  );
  await phone.screenshot({
    path: new URL('../outputs/preview-p3r-mobile.png', import.meta.url)
      .pathname,
    fullPage: true,
  });
  await mobile.close();
  assert.deepEqual(errors, []);
  assert.equal(cloudRequests, 0, 'no production cloud requests attempted');
  console.log(
    JSON.stringify({
      ok: true,
      realIndexedDBReload: true,
      twoTabConflict: true,
      filters: true,
      locales: ['zh', 'en', 'es'],
      themes: ['classic', 'p3r'],
      mobileViewport: true,
      lazyAudioPlayback: true,
      productionCloudRequests: cloudRequests,
    }),
  );
} finally {
  await browser.close();
}
