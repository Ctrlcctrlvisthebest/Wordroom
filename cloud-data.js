import {
  FIELDS,
  MAX_CSV_ROWS,
  MAX_CSV_COLUMNS,
  createWords,
} from './wordroom.js?v=cloud1';

export const MAX_CLOUD_BYTES = 10 * 1024 * 1024;
export const MAX_CLOUD_LISTS = 20;
export const MAX_LIBRARY_BYTES = 40 * 1024 * 1024;

export function validSyncCode(value) {
  return typeof value === 'string' && /^wr1_[a-f0-9]{64}$/.test(value);
}

export function newSyncCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    'wr1_' +
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  );
}

// The same validation runs before upload, at the API boundary, and on restore.
// Whitespace and unmapped CSV columns stay intact for lossless starred exports.
export function validateSnapshot(value) {
  const invalid = () => {
    throw new Error('invalidSnapshot');
  };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const { schemaVersion, name, headers, rows, mapping, starred } = value;
  if (
    schemaVersion !== 1 ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 200
  )
    invalid();
  if (
    !Array.isArray(headers) ||
    !headers.length ||
    headers.length > MAX_CSV_COLUMNS ||
    headers.some((cell) => typeof cell !== 'string')
  )
    invalid();
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_CSV_ROWS)
    invalid();
  for (const row of rows) {
    if (
      !Array.isArray(row) ||
      !row.length ||
      row.length > headers.length ||
      row.some((cell) => typeof cell !== 'string')
    )
      invalid();
  }
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping))
    invalid();
  const used = new Set();
  for (const field of FIELDS) {
    const column = mapping[field];
    if (column === null && field !== 'word') continue;
    if (
      !Number.isInteger(column) ||
      column < 0 ||
      column >= headers.length ||
      used.has(column)
    )
      invalid();
    used.add(column);
  }
  const words = createWords(rows, mapping);
  if (!words.length) invalid();
  if (!Array.isArray(starred) || starred.length > words.length) invalid();
  const indices = new Set(words.map((word) => word.sourceIndex));
  if (
    starred.some((index) => !Number.isInteger(index) || !indices.has(index)) ||
    new Set(starred).size !== starred.length
  )
    invalid();
  const snapshot = {
    schemaVersion: 1,
    name,
    headers,
    rows,
    mapping: Object.fromEntries(FIELDS.map((field) => [field, mapping[field]])),
    starred,
  };
  const serialized = JSON.stringify(snapshot);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_CLOUD_BYTES) throw new Error('cloudTooLarge');
  return { snapshot, serialized, bytes, words };
}
