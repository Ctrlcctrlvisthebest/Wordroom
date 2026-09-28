import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkStaticRelease } from '../scripts/check-release.mjs';
import {
  FIELDS,
  OPTIONAL_FIELDS,
  SUPPORTED_LOCALES,
  TRANSLATIONS,
  detectMapping,
  createWords,
} from '../wordroom.js';
import { validateSnapshot } from '../cloud-data.js';

async function fixture(t, files) {
  const root = await mkdtemp(path.join(tmpdir(), 'wordroom-release-check-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return root;
}

void test('release checker follows HTML, module, theme and playlist assets without network', async (t) => {
  const root = await fixture(t, {
    'index.html':
      '<script type="module" src="./main.js?v=2"></script><link href="./base.css"><a href="https://example.test/">external</a>',
    'main.js':
      'import "./shared.js?v=2"; new URL("./theme.css?v=1", import.meta.url); const audio = "./audio/test.m4a";',
    'shared.js': 'export const name = "test";',
    'theme.css': '.test { color: blue; }',
    'base.css': 'body { background: url("./icon.svg"); }',
    'icon.svg': '<svg/>',
    'audio/test.m4a': 'synthetic fixture, not playable audio',
  });
  const result = await checkStaticRelease(root);
  assert.equal(result.ok, true);
  assert.equal(result.filesChecked, 7);
  assert.equal(result.modulesChecked, 2);
  assert.deepEqual(result.errors, []);
});

void test('release checker reports broken asset, stale module URL and Pages-root paths', async (t) => {
  const root = await fixture(t, {
    'index.html':
      '<script src="./main.js?v=2"></script><script src="./shared.js?v=1"></script><link href="/root.css"><img src="./missing.svg">',
    'main.js': 'import "./shared.js?v=2"; import "../outside.js";',
    'shared.js': 'export const ok = true;',
  });
  const result = await checkStaticRelease(root);
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.includes('missing.svg')));
  assert(
    result.errors.some((error) =>
      error.includes('Inconsistent module URLs for shared.js'),
    ),
  );
  assert(result.errors.some((error) => error.includes('root-relative URL')));
  assert(
    result.errors.some((error) => error.includes('escapes the site root')),
  );
});

void test('HTML optional controls, locales, CSV records and cloud mapping share the same fields', async () => {
  const html = await readFile(
    new URL('../index.html', import.meta.url),
    'utf8',
  );
  const checkboxFields = Array.from(
    html.matchAll(/data-include="([^"]+)"/g),
    (match) => match[1],
  );
  assert.deepEqual(checkboxFields, OPTIONAL_FIELDS);
  for (const locale of SUPPORTED_LOCALES) {
    for (const field of FIELDS) {
      assert.equal(typeof TRANSLATIONS[locale][`field_${field}`], 'string');
      assert(TRANSLATIONS[locale][`field_${field}`].trim());
    }
  }
  const headers = [...FIELDS, 'unmapped-original-column'];
  const row = headers.map((header) => `raw-${header}`);
  const mapping = detectMapping(headers);
  assert.deepEqual(
    mapping,
    Object.fromEntries(FIELDS.map((field, index) => [field, index])),
  );
  const snapshot = {
    schemaVersion: 1,
    name: 'release-contract.csv',
    headers,
    rows: [row],
    mapping,
    starred: [0],
  };
  const validated = validateSnapshot(snapshot);
  assert.deepEqual(validated.snapshot, snapshot);
  assert.deepEqual(validated.words, createWords([row], mapping));
  for (const field of FIELDS)
    assert.equal(validated.words[0][field], `raw-${field}`);

  const legacy = structuredClone(snapshot);
  delete legacy.mapping.association;
  assert.deepEqual(validateSnapshot(legacy).snapshot, legacy);
  assert.equal(validateSnapshot(legacy).words[0].association, '');
  const duplicate = structuredClone(snapshot);
  duplicate.mapping.association = duplicate.mapping.word;
  assert.throws(() => validateSnapshot(duplicate), /invalidSnapshot/);
});

void test('GitHub static entry point has no missing or inconsistent local references', async () => {
  const result = await checkStaticRelease();
  assert.equal(result.ok, true, result.errors.join('\n'));
});
