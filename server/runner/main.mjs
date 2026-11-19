import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { evaluateJavaSubmission } from './java-subset.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(directory, '../.env')); } catch { /* The API reports an unavailable runner when local settings are absent. */ }
const host = process.env.JAVA_RUNNER_HOST ?? '127.0.0.1';
const port = Number(process.env.JAVA_RUNNER_PORT ?? 3101);
const secret = process.env.JAVA_RUNNER_TOKEN ?? '';
const maxBody = 300_000;

function send(response, status, body) {
  const text = JSON.stringify(body);
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text), 'Cache-Control': 'no-store' });
  response.end(text);
}

function authorized(request) {
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
  const left = Buffer.from(supplied); const right = Buffer.from(secret);
  return secret.length >= 32 && left.length === right.length && timingSafeEqual(left, right);
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return send(response, 200, { status: 'ready', interpreter: 'java-learning-subset-v1' });
  if (request.method !== 'POST' || request.url !== '/evaluate') return send(response, 404, { message: 'Not found.' });
  if (!authorized(request)) return send(response, 401, { message: 'Unauthorized.' });
  let raw = ''; let tooLarge = false;
  for await (const chunk of request) {
    raw += chunk.toString('utf8');
    if (Buffer.byteLength(raw) > maxBody) { tooLarge = true; break; }
  }
  if (tooLarge) return send(response, 413, { message: 'Request is too large.' });
  try {
    const payload = JSON.parse(raw);
    const result = evaluateJavaSubmission(payload.code, payload.customInput, payload.cases);
    return send(response, 200, result);
  } catch (error) {
    return send(response, 200, { error: error instanceof Error ? error.message.slice(0, 240) : 'The program could not be interpreted.' });
  }
});

if (!secret || secret.length < 32) {
  console.error('Java interpreter stopped: set JAVA_RUNNER_TOKEN to a random value of at least 32 characters in server/.env.');
  process.exit(1);
}
server.listen(port, host, () => console.log(`CodeIT Java learning interpreter listening on ${host}:${port}.`));
