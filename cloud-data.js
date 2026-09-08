import {
  FIELDS,
  MAX_CSV_ROWS,
  MAX_CSV_COLUMNS,
  MAX_CSV_SOURCES,
  combineSourceWords,
} from './wordroom.js?v=multi1';

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
function invalid() {
  throw new Error('invalidSnapshot');
}

function validateSource(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const { name, headers, rows, mapping } = value;
  if (typeof name !== 'string' || !name.trim() || name.length > 200) invalid();
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
  if (!rows.some((row) => (row[mapping.word] || '').trim())) invalid();
  return {
    name,
    headers,
    rows,
    mapping: Object.fromEntries(FIELDS.map((field) => [field, mapping[field]])),
  };
}

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const { schemaVersion, name, starred } = value;
  if (
    ![1, 2].includes(schemaVersion) ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 200
  )
    invalid();
  const rawSources = schemaVersion === 1 ? [value] : value.sources;
  if (
    !Array.isArray(rawSources) ||
    !rawSources.length ||
    rawSources.length > MAX_CSV_SOURCES
  )
    invalid();
  // Check aggregate row limits before constructing study records, including
  // blank-word rows, which still occupy stable source indices.
  let rowCount = 0;
  const sources = rawSources.map((source) => {
    if (!Array.isArray(source?.rows)) invalid();
    rowCount += source.rows.length;
    if (rowCount > MAX_CSV_ROWS) invalid();
    return validateSource(source);
  });
  const words = combineSourceWords(sources);
  if (!Array.isArray(starred) || starred.length > words.length) invalid();
  const indices = new Set(words.map((word) => word.sourceIndex));
  if (
    starred.some((index) => !Number.isInteger(index) || !indices.has(index)) ||
    new Set(starred).size !== starred.length
  )
    invalid();
  const snapshot = {
    ...(schemaVersion === 1
      ? {
          schemaVersion: 1,
          headers: sources[0].headers,
          rows: sources[0].rows,
          mapping: sources[0].mapping,
        }
      : { schemaVersion: 2, sources }),
    name,
    starred,
  };
  const serialized = JSON.stringify(snapshot);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_CLOUD_BYTES) throw new Error('cloudTooLarge');
  return { snapshot, serialized, bytes, words };
}
