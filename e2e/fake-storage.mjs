/**
 * Atrapa Supabase Storage dla testów E2E (playwright.config.ts, czwarty webServer).
 *
 * Środowisko E2E nie ma prawdziwego Storage, a upload obrazów tablicy idzie z BACKENDU
 * (page.route w przeglądarce tego nie przechwyci). Backend dostaje więc
 * SUPABASE_URL=http://127.0.0.1:<port> i rozmawia z tym serwerem dokładnie tak, jak
 * z prawdziwym Storage - w kodzie produkcyjnym nie ma żadnego trybu testowego.
 *
 * Pliki i buckety żyją w pamięci; start z pustym stanem = backend przechodzi też przez
 * tworzenie bucketu ("Bucket not found" -> POST /bucket -> ponowny upload).
 * Obsługiwane (podzbiór API Storage używany przez backend/core/storage.py):
 *   POST   /storage/v1/bucket
 *   POST   /storage/v1/object/list/{bucket}
 *   POST   /storage/v1/object/{bucket}/{ścieżka}
 *   GET    /storage/v1/object/{bucket}/{ścieżka}
 *   DELETE /storage/v1/object/{bucket}
 * Dodatkowo dla testów: GET /__state (buckety i klucze obiektów), GET /health.
 * Wszystko inne (np. broadcast powiadomień /realtime/...) -> 404; backend traktuje to
 * jako błąd best-effort.
 */
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8211);
const PREFIX = '/storage/v1/';

/** id bucketu -> { public, allowed_mime_types, file_size_limit } */
const buckets = new Map();
/** "bucket/ścieżka" -> { data: Buffer, contentType: string } */
const objects = new Map();

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

// Prawdziwy Storage odpowiada tu HTTP 400 z "statusCode": "404" - backend ma to rozpoznać.
const bucketNotFound = (res) =>
  sendJson(res, 400, { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' });

function parseJson(buffer) {
  try {
    return JSON.parse(buffer.toString('utf-8') || '{}');
  } catch {
    return null;
  }
}

async function handle(req, res) {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = decodeURIComponent(url.pathname);

  if (req.method === 'GET' && path === '/health') return sendJson(res, 200, { ok: true });
  if (req.method === 'GET' && path === '/__state') {
    return sendJson(res, 200, {
      buckets: Object.fromEntries(buckets),
      objects: [...objects.entries()].map(([key, value]) => ({
        key,
        contentType: value.contentType,
        size: value.data.length,
      })),
    });
  }

  if (!path.startsWith(PREFIX)) return sendJson(res, 404, { message: 'not found' });
  if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) {
    return sendJson(res, 401, { statusCode: '401', error: 'Unauthorized', message: 'no token' });
  }
  const rest = path.slice(PREFIX.length);
  const body = await readBody(req);

  if (rest === 'bucket' && req.method === 'POST') {
    const spec = parseJson(body);
    if (!spec || typeof spec.id !== 'string') return sendJson(res, 400, { message: 'bad body' });
    if (buckets.has(spec.id)) {
      return sendJson(res, 400, {
        statusCode: '409',
        error: 'Duplicate',
        message: 'The resource already exists',
      });
    }
    buckets.set(spec.id, {
      public: spec.public === true,
      allowed_mime_types: spec.allowed_mime_types ?? null,
      file_size_limit: spec.file_size_limit ?? null,
    });
    return sendJson(res, 200, { name: spec.id });
  }

  if (rest.startsWith('object/list/') && req.method === 'POST') {
    const bucket = rest.slice('object/list/'.length);
    if (!buckets.has(bucket)) return bucketNotFound(res);
    const query = parseJson(body) ?? {};
    const prefix = `${bucket}/${query.prefix ?? ''}`;
    const offset = Number(query.offset ?? 0);
    const limit = Number(query.limit ?? 100);
    const names = [...objects.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
      .sort()
      .slice(offset, offset + limit);
    return sendJson(
      res,
      200,
      names.map((name) => ({ name, id: `id-${name}` }))
    );
  }

  if (rest.startsWith('object/')) {
    const key = rest.slice('object/'.length);
    const bucket = key.split('/', 1)[0];
    if (!buckets.has(bucket)) return bucketNotFound(res);

    if (req.method === 'POST') {
      const contentType = req.headers['content-type'] ?? 'application/octet-stream';
      const allowed = buckets.get(bucket).allowed_mime_types;
      if (Array.isArray(allowed) && !allowed.includes(contentType)) {
        return sendJson(res, 400, {
          statusCode: '415',
          error: 'invalid_mime_type',
          message: `mime type ${contentType} is not supported`,
        });
      }
      if (objects.has(key)) {
        return sendJson(res, 400, {
          statusCode: '409',
          error: 'Duplicate',
          message: 'The resource already exists',
        });
      }
      objects.set(key, { data: body, contentType });
      return sendJson(res, 200, { Key: key });
    }
    if (req.method === 'GET') {
      const object = objects.get(key);
      if (!object) {
        return sendJson(res, 400, {
          statusCode: '404',
          error: 'not_found',
          message: 'Object not found',
        });
      }
      res.writeHead(200, {
        'Content-Type': object.contentType,
        'Content-Length': object.data.length,
      });
      return res.end(object.data);
    }
    if (req.method === 'DELETE') {
      const prefixes = parseJson(body)?.prefixes;
      if (!Array.isArray(prefixes)) return sendJson(res, 400, { message: 'bad body' });
      for (const name of prefixes) objects.delete(`${bucket}/${name}`);
      return sendJson(res, 200, []);
    }
  }

  return sendJson(res, 404, { message: 'not found' });
}

http
  .createServer((req, res) => {
    handle(req, res).catch((err) => {
      console.error('[fake-storage]', err);
      if (!res.headersSent) sendJson(res, 500, { message: 'fake storage error' });
      else res.end();
    });
  })
  .listen(PORT, '127.0.0.1', () => {
    console.log(`[fake-storage] http://127.0.0.1:${PORT}`);
  });
