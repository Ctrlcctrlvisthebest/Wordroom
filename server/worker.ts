import {
  MAX_CLOUD_BYTES,
  MAX_CLOUD_LISTS,
  MAX_LIBRARY_BYTES,
  validSyncCode,
  validateSnapshot,
} from '../cloud-data.js';

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
interface LibraryRow {
  id: string;
  name: string;
  revision: string;
  word_count: number;
  byte_length: number;
  updated_at: number;
}
const validId = (value: string) =>
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    value,
  );
const metadata = (row: LibraryRow) => ({
  id: row.id,
  name: row.name,
  revision: row.revision,
  wordCount: row.word_count,
  bytes: row.byte_length,
  updatedAt: row.updated_at,
});

export async function readBoundedJSON(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get('Content-Type')
      ?.toLowerCase()
      .startsWith('application/json')
  )
    throw new ApiError(415, 'invalidSnapshot');
  const length = Number(request.headers.get('Content-Length'));
  if (length > MAX_CLOUD_BYTES) throw new ApiError(413, 'cloudTooLarge');
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalidSnapshot');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CLOUD_BYTES) {
        await reader.cancel();
        throw new ApiError(413, 'cloudTooLarge');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new ApiError(400, 'invalidSnapshot');
  }
}

export function splitSnapshot(text: string) {
  const parts: string[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + 384 * 1024, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end--;
    parts.push(text.slice(start, end));
    start = end;
  }
  return parts;
}

async function identity(request: Request) {
  const token = request.headers
    .get('Authorization')
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!validSyncCode(token)) throw new ApiError(401, 'invalidCode');
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function route(request: Request, env: CloudEnv) {
  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET')
    return Response.json({ ok: true, service: 'wordroom-cloud', version: 1 });
  const match = url.pathname.match(/^\/v1\/libraries(?:\/([^/]+))?$/);
  if (!match) throw new ApiError(404, 'notFound');
  const owner = await identity(request);
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (!(await env.REQUEST_LIMIT.limit({ key: ip })).success)
    throw new ApiError(429, 'rateLimited');
  if (
    request.method !== 'GET' &&
    !(await env.WRITE_LIMIT.limit({ key: ip })).success
  )
    throw new ApiError(429, 'rateLimited');
  const db = env.DB.withSession('first-primary');
  const id = match[1];
  if (!id) {
    if (request.method !== 'GET') throw new ApiError(405, 'methodNotAllowed');
    const { results } = await db
      .prepare(
        'SELECT id,name,revision,word_count,byte_length,updated_at FROM libraries WHERE owner=? ORDER BY updated_at DESC,id LIMIT ?',
      )
      .bind(owner, MAX_CLOUD_LISTS)
      .all<LibraryRow>();
    return Response.json({ libraries: results.map(metadata) });
  }
  if (!validId(id)) throw new ApiError(400, 'invalidRequest');
  if (request.method === 'GET') {
    // One SELECT gives a consistent snapshot even if another device saves now.
    const { results } = await db
      .prepare(
        'SELECT l.id,l.name,l.revision,l.word_count,l.byte_length,l.updated_at,p.data FROM libraries l JOIN library_parts p ON p.owner=l.owner AND p.library_id=l.id WHERE l.owner=? AND l.id=? ORDER BY p.part_index',
      )
      .bind(owner, id)
      .all<LibraryRow & { data: string }>();
    if (!results.length) throw new ApiError(404, 'notFound');
    return Response.json({
      ...metadata(results[0]),
      snapshot: JSON.parse(results.map((row) => row.data).join('')),
    });
  }
  if (request.method !== 'PUT' && request.method !== 'DELETE')
    throw new ApiError(405, 'methodNotAllowed');
  const matchHeader = request.headers.get('If-Match');
  const expected = matchHeader?.match(/^"([a-f0-9-]+)"$/)?.[1] ?? null;
  if (matchHeader && !expected) throw new ApiError(428, 'preconditionRequired');
  const create = request.headers.get('If-None-Match') === '*';
  if (
    expected
      ? !validId(expected) || create
      : !create || request.method === 'DELETE'
  )
    throw new ApiError(428, 'preconditionRequired');
  if (request.method === 'DELETE') {
    const result = await db
      .prepare('DELETE FROM libraries WHERE owner=? AND id=? AND revision=?')
      .bind(owner, id, expected)
      .run();
    if (!result.meta.changes) throw new ApiError(409, 'conflict');
    return Response.json({ deleted: true });
  }
  let validated;
  try {
    validated = validateSnapshot(await readBoundedJSON(request));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error && error.message === 'cloudTooLarge' ? 413 : 400,
      error instanceof Error && error.message === 'cloudTooLarge'
        ? 'cloudTooLarge'
        : 'invalidSnapshot',
    );
  }
  const { snapshot, serialized, bytes, words } = validated;
  const existing = await db
    .prepare(
      'SELECT id,name,revision,word_count,byte_length,updated_at FROM libraries WHERE owner=? AND id=?',
    )
    .bind(owner, id)
    .first<LibraryRow>();
  if (create ? existing !== null : existing?.revision !== expected)
    throw new ApiError(409, 'conflict');
  const usage = await db
    .prepare(
      'SELECT COUNT(*) AS count,COALESCE(SUM(byte_length),0) AS bytes FROM libraries WHERE owner=?',
    )
    .bind(owner)
    .first<{ count: number; bytes: number }>();
  if (
    (create && (usage?.count ?? 0) >= MAX_CLOUD_LISTS) ||
    (usage?.bytes ?? 0) - (existing?.byte_length ?? 0) + bytes >
      MAX_LIBRARY_BYTES
  )
    throw new ApiError(413, 'quotaExceeded');
  const revision = crypto.randomUUID();
  const now = Date.now();
  // Repeat quota and revision checks inside the atomic batch: concurrent clients
  // cannot bypass the quota or silently overwrite a newer snapshot.
  const begin = create
    ? db
        .prepare(
          'INSERT INTO libraries(owner,id,name,revision,word_count,byte_length,updated_at) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM libraries WHERE owner=?)<? AND (SELECT COALESCE(SUM(byte_length),0) FROM libraries WHERE owner=?)+?<=? ON CONFLICT(owner,id) DO NOTHING',
        )
        .bind(
          owner,
          id,
          snapshot.name,
          revision,
          words.length,
          bytes,
          now,
          owner,
          MAX_CLOUD_LISTS,
          owner,
          bytes,
          MAX_LIBRARY_BYTES,
        )
    : db
        .prepare(
          'UPDATE libraries SET name=?,revision=?,word_count=?,byte_length=?,updated_at=? WHERE owner=? AND id=? AND revision=? AND (SELECT COALESCE(SUM(byte_length),0) FROM libraries WHERE owner=?)-byte_length+?<=?',
        )
        .bind(
          snapshot.name,
          revision,
          words.length,
          bytes,
          now,
          owner,
          id,
          expected,
          owner,
          bytes,
          MAX_LIBRARY_BYTES,
        );
  const statements = [
    begin,
    db
      .prepare(
        'DELETE FROM library_parts WHERE owner=? AND library_id=? AND EXISTS(SELECT 1 FROM libraries WHERE owner=? AND id=? AND revision=?)',
      )
      .bind(owner, id, owner, id, revision),
    ...splitSnapshot(serialized).map((part, index) =>
      db
        .prepare(
          'INSERT INTO library_parts(owner,library_id,part_index,data) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM libraries WHERE owner=? AND id=? AND revision=?)',
        )
        .bind(owner, id, index, part, owner, id, revision),
    ),
  ];
  const result = await db.batch(statements);
  if (!result[0].meta.changes) throw new ApiError(409, 'conflict');
  return Response.json(
    {
      id,
      name: snapshot.name,
      revision,
      wordCount: words.length,
      bytes,
      updatedAt: now,
    },
    { status: create ? 201 : 200 },
  );
}

export default {
  async fetch(request: Request, env: CloudEnv): Promise<Response> {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGINS.split(',').includes(origin || '');
    const headers = new Headers({
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
    });
    if (allowed && origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
      headers.set(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, If-Match, If-None-Match',
      );
    }
    let response: Response;
    try {
      if (origin && !allowed) throw new ApiError(403, 'originDenied');
      response =
        request.method === 'OPTIONS'
          ? new Response(null, { status: 204 })
          : await route(request, env);
    } catch (error) {
      const known = error instanceof ApiError;
      if (!known)
        console.error(JSON.stringify({ event: 'cloud_request_failed' }));
      // Never log credentials, request bodies, names, or vocabulary content.
      response = Response.json(
        { error: known ? error.code : 'serverError' },
        { status: known ? error.status : 500 },
      );
      if (known && error.status === 429) headers.set('Retry-After', '60');
    }
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  },
} satisfies ExportedHandler<CloudEnv>;
