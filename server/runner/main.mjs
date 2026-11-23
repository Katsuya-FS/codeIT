import { createServer } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createInteractiveProgram, evaluateJavaSubmission, interpretJavaSubset } from './java-subset.mjs';

const directory = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(directory, '../.env')); } catch { /* The API reports an unavailable runner when local settings are absent. */ }
const host = process.env.JAVA_RUNNER_HOST ?? '127.0.0.1';
const port = Number(process.env.JAVA_RUNNER_PORT ?? 3101);
const secret = process.env.JAVA_RUNNER_TOKEN ?? '';
const maxBody = 300_000;
const sessions = new Map();
const sessionTtlMs = 5 * 60_000;

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

async function readJson(request) {
  let raw = ''; let tooLarge = false;
  for await (const chunk of request) {
    raw += chunk.toString('utf8');
    if (Buffer.byteLength(raw) > maxBody) { tooLarge = true; break; }
  }
  if (tooLarge) throw Object.assign(new Error('Request is too large.'), { status: 413 });
  try { return JSON.parse(raw || '{}'); } catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}

function pruneSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) if (now - session.lastActivity > sessionTtlMs) sessions.delete(id);
}

function advance(session, suppliedInput) {
  try {
    let step = session.program.next(suppliedInput);
    while (!step.done) {
      if (step.value.type === 'output') session.events.push({ id: session.nextEvent++, type: 'output', text: step.value.text });
      else {
        session.waitingForInput = true; session.waitingMethod = step.value.method;
        session.events.push({ id: session.nextEvent++, type: 'input', method: step.value.method });
        if (session.events.length > 1000) session.events.splice(0, session.events.length - 1000);
        session.lastActivity = Date.now();
        return;
      }
      if (session.events.length > 1000) session.events.splice(0, session.events.length - 1000);
      step = session.program.next();
    }
    session.events.push({ id: session.nextEvent++, type: 'done' }); session.finished = true;
  } catch (error) {
    session.events.push({ id: session.nextEvent++, type: 'error', message: error instanceof Error ? error.message.slice(0, 240) : 'The program could not be interpreted.' });
    session.finished = true;
  }
  session.waitingForInput = false; session.lastActivity = Date.now();
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return send(response, 200, { status: 'ready', interpreter: 'java-learning-subset-v1' });
  if (!authorized(request)) return send(response, 401, { message: 'Unauthorized.' });
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method === 'POST' && url.pathname === '/run') {
      const payload = await readJson(request);
      return send(response, 200, { output: interpretJavaSubset(payload.code, payload.input ?? '') });
    }
    if (request.method === 'POST' && url.pathname === '/evaluate') {
      const payload = await readJson(request);
      return send(response, 200, evaluateJavaSubmission(payload.code, payload.customInput, payload.cases));
    }
    if (request.method === 'POST' && url.pathname === '/sessions') {
      pruneSessions();
      if (sessions.size >= 100) return send(response, 429, { message: 'Too many interactive sessions are active. Try again shortly.' });
      const payload = await readJson(request);
      if (typeof payload.ownerId !== 'string' || payload.ownerId.length > 80) return send(response, 400, { message: 'Session owner is invalid.' });
      const session = { id: randomUUID(), ownerId: payload.ownerId, program: createInteractiveProgram(payload.code), events: [], nextEvent: 1, lastActivity: Date.now(), waitingForInput: false, finished: false };
      sessions.set(session.id, session); advance(session);
      return send(response, 201, { sessionId: session.id });
    }
    const match = url.pathname.match(/^\/sessions\/([\da-f-]{36})(?:\/(events|input))?$/i);
    if (match) {
      const session = sessions.get(match[1]);
      if (!session || session.ownerId !== url.searchParams.get('ownerId')) return send(response, 404, { message: 'Interactive session not found.' });
      session.lastActivity = Date.now();
      if (request.method === 'GET' && match[2] === 'events') {
        const cursor = Number(url.searchParams.get('cursor') ?? 0);
        if (!Number.isSafeInteger(cursor) || cursor < 0) return send(response, 400, { message: 'Event cursor is invalid.' });
        return send(response, 200, { events: session.events.filter((event) => event.id > cursor), finished: session.finished });
      }
      if (request.method === 'POST' && match[2] === 'input') {
        if (!session.waitingForInput || session.finished) return send(response, 409, { message: 'The program is not waiting for input.' });
        const payload = await readJson(request);
        if (typeof payload.input !== 'string' || payload.input.length > 1000 || (session.waitingMethod !== 'nextLine' && (!payload.input.length || /\s/.test(payload.input)))) return send(response, 400, { message: session.waitingMethod === 'nextLine' ? 'Enter a line under 1,000 characters.' : 'Enter one input value without spaces.' });
        session.waitingForInput = false; advance(session, payload.input);
        return send(response, 200, { accepted: true });
      }
      if (request.method === 'DELETE' && !match[2]) { sessions.delete(session.id); return send(response, 200, { ended: true }); }
    }
    return send(response, 404, { message: 'Not found.' });
  } catch (error) {
    const status = Number((error)?.status) || 200;
    return send(response, status, { error: error instanceof Error ? error.message.slice(0, 240) : 'The program could not be interpreted.' });
  }
});

if (!secret || secret.length < 32) {
  console.error('Java interpreter stopped: set JAVA_RUNNER_TOKEN to a random value of at least 32 characters in server/.env.');
  process.exit(1);
}
server.listen(port, host, () => console.log(`CodeIT Java learning interpreter listening on ${host}:${port}.`));
