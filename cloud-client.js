import {
  MAX_CLOUD_BYTES,
  validateSnapshot,
  validSyncCode,
} from './cloud-data.js?v=optimization1';

const ERROR_CODES = new Set([
  'invalidCode',
  'invalidSnapshot',
  'invalidResponse',
  'cloudTooLarge',
  'quotaExceeded',
  'conflict',
  'notFound',
  'rateLimited',
  'timeout',
  'serverError',
  'networkError',
  'originDenied',
  'notConfigured',
  'invalidRequest',
  'methodNotAllowed',
  'preconditionRequired',
]);

// Do not expose arbitrary server bodies, request URLs, or credentials in errors.
export function cloudErrorCode(error) {
  return ERROR_CODES.has(error?.message) ? error.message : 'serverError';
}

function requestError(code, status = 0) {
  const error = new Error(ERROR_CODES.has(code) ? code : 'serverError');
  if (Number.isInteger(status) && status >= 400 && status <= 599)
    error.status = status;
  return error;
}

export function uncertainSave(error) {
  return [
    'timeout',
    'networkError',
    'serverError',
    'invalidResponse',
    'conflict',
  ].includes(cloudErrorCode(error));
}

export class CloudClient {
  constructor(baseURL, code, fetcher = globalThis.fetch.bind(globalThis)) {
    if (!validSyncCode(code)) throw new Error('invalidCode');
    const url = new URL(baseURL);
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )
    )
      throw new Error('notConfigured');
    this.baseURL = url.origin;
    this.code = code;
    // Native Window.fetch requires its original receiver, unlike Node fetch.
    this.fetcher = fetcher;
  }
  async request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await this.fetcher(
        this.baseURL + '/v1/libraries' + path,
        {
          ...options,
          headers: { ...options.headers, Authorization: `Bearer ${this.code}` },
          signal: controller.signal,
          credentials: 'omit',
          cache: 'no-store',
          referrerPolicy: 'no-referrer',
        },
      );
      if (
        Number(response.headers.get('Content-Length')) >
        MAX_CLOUD_BYTES + 65536
      )
        throw new Error('invalidResponse');
      let data;
      try {
        data = await response.json();
      } catch {
        throw requestError(
          response.ok ? 'invalidResponse' : 'serverError',
          response.status,
        );
      }
      if (!response.ok) throw requestError(data?.error, response.status);
      return data;
    } catch (error) {
      if (error?.name === 'AbortError') throw requestError('timeout');
      if (error instanceof TypeError) throw requestError('networkError');
      throw requestError(cloudErrorCode(error), error?.status);
    } finally {
      clearTimeout(timer);
    }
  }
  async list() {
    const data = await this.request('');
    if (
      !Array.isArray(data?.libraries) ||
      data.libraries.length > 20 ||
      data.libraries.some((row) => !validEntry(row))
    )
      throw new Error('invalidResponse');
    return data.libraries;
  }
  async load(id) {
    const data = await this.request('/' + encodeURIComponent(id));
    if (!validEntry(data) || data.id !== id) throw new Error('invalidResponse');
    const { snapshot, ...entry } = data;
    return { entry, validated: validateSnapshot(snapshot) };
  }
  /** @param {string} id @param {unknown} snapshot @param {string | null} revision */
  async save(id, snapshot, revision = null) {
    const { serialized } = validateSnapshot(snapshot);
    const entry = await this.request('/' + encodeURIComponent(id), {
      method: 'PUT',
      body: serialized,
      headers: {
        'Content-Type': 'application/json',
        ...(revision
          ? { 'If-Match': `"${revision}"` }
          : { 'If-None-Match': '*' }),
      },
    });
    if (!validEntry(entry) || entry.id !== id)
      throw new Error('invalidResponse');
    return entry;
  }
  async delete(entry) {
    return this.request('/' + encodeURIComponent(entry.id), {
      method: 'DELETE',
      headers: { 'If-Match': `"${entry.revision}"` },
    });
  }
}

function validEntry(row) {
  const uuid =
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  return (
    row &&
    typeof row === 'object' &&
    uuid.test(row.id) &&
    uuid.test(row.revision) &&
    typeof row.name === 'string' &&
    row.name.length <= 200 &&
    Number.isInteger(row.wordCount) &&
    row.wordCount > 0 &&
    row.wordCount <= 20000 &&
    Number.isFinite(row.updatedAt) &&
    row.updatedAt > 0
  );
}
