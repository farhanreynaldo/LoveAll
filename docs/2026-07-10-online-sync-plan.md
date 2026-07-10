# Live Sharing + Durable History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer optionally "go live" so spectators can watch standings update in real time via a plain link (no install/login), and let completed sessions persist into a durable cross-session history, without changing any of today's offline local-play behavior.

**Architecture:** A new `worker/` package (Cloudflare Worker + one `SessionRoom` Durable Object per session, plus a D1 table for history) sits alongside the existing static PWA. The existing app gains a small opt-in sync client (`src/sync.js`) that pushes state snapshots when online; nothing else about local scoring changes. A separate static `watch.html` lets spectators connect read-only. See `docs/2026-07-10-online-sync-design.md` for full rationale.

**Tech Stack:** Cloudflare Workers, Durable Objects, D1, native WebSocket API (Workers runtime) — no new client-side frameworks. Worker tests use `vitest` + `@cloudflare/vitest-pool-workers` (new devDependency, isolated to `worker/`). Client tests continue to use `node:test` (existing convention).

## Global Constraints

- No signup/login UI for anyone, organizer or spectator. Organizer identity is a silent token in `localStorage` (crypto.randomUUID()).
- Local scoring must keep working fully offline; sync is best-effort and must never block or throw into the scoring UI.
- Single-writer model: only the organizer device pushes state; no merge/conflict logic for concurrent writers (last-write-wins is accepted).
- Whole-snapshot sync, not diffs — the state object is small.
- Rooms expire ~48h after creation; history rows are permanent.

---

### Task 1: Worker scaffold + room code generator

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/room-code.js`
- Test: `worker/test/room-code.test.js`
- Create: `worker/vitest.config.js`

**Interfaces:**
- Produces: `generateRoomCode(): string` — a 4-character room code from an unambiguous charset, used by Task 2.

- [ ] **Step 1: Create the worker package manifest**

```json
{
  "name": "loveall-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^3.78.0",
    "vitest": "^2.1.0",
    "@cloudflare/vitest-pool-workers": "^0.6.0"
  }
}
```

Run: `cd worker && npm install`

- [ ] **Step 2: Create `worker/wrangler.toml`**

```toml
name = "loveall-sync"
main = "src/index.js"
compatibility_date = "2026-06-01"

[[durable_objects.bindings]]
name = "SESSION_ROOM"
class_name = "SessionRoom"

[[migrations]]
tag = "v1"
new_classes = ["SessionRoom"]

[[d1_databases]]
binding = "DB"
database_name = "loveall_history"
database_id = "REPLACE_AFTER_RUNNING_WRANGLER_D1_CREATE"
```

Note for the user (not the agent): `database_id` above is a placeholder that only becomes real after running `wrangler d1 create loveall_history` against your own Cloudflare account — that command is not something an agent can run without your credentials. Everything else in this plan runs and tests locally without it.

- [ ] **Step 3: Write the failing test for room code generation**

```js
// worker/test/room-code.test.js
import { describe, it, expect } from 'vitest';
import { generateRoomCode } from '../src/room-code.js';

describe('generateRoomCode', () => {
  it('returns a 4-character code from the unambiguous charset', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(4);
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  });

  it('is not obviously deterministic across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 4: Create `worker/vitest.config.js`**

```js
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.toml' },
      },
    },
  },
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd worker && npx vitest run`
Expected: FAIL with "Cannot find module '../src/room-code.js'"

- [ ] **Step 6: Implement the room code generator**

```js
// worker/src/room-code.js
// Charset excludes 0/O, 1/I/L to avoid visual ambiguity when read off a screen.
const CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function generateRoomCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let code = '';
  for (const b of bytes) code += CHARSET[b % CHARSET.length];
  return code;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd worker && npx vitest run`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add worker/package.json worker/wrangler.toml worker/vitest.config.js worker/src/room-code.js worker/test/room-code.test.js
git commit -m "Scaffold Cloudflare worker package with a room code generator"
```

---

### Task 2: Room creation endpoint + `SessionRoom` init

**Files:**
- Create: `worker/src/session-room.js`
- Create: `worker/src/index.js`
- Test: `worker/test/rooms.test.js`

**Interfaces:**
- Consumes: `generateRoomCode()` from Task 1.
- Produces: `SessionRoom` Durable Object class (exported from `worker/src/index.js` per Workers convention); `POST /rooms` route returning `{ code, roomToken }`; used by Task 3 (WebSocket handling) and by the client in Task 6.

- [ ] **Step 1: Write the failing test for room creation**

```js
// worker/test/rooms.test.js
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';
import { env } from 'cloudflare:test';

describe('POST /rooms', () => {
  it('creates a room and returns a code and token', async () => {
    const res = await worker.fetch(
      new Request('https://loveall.test/rooms', {
        method: 'POST',
        headers: { Authorization: 'Bearer organizer-token-abc' },
      }),
      env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toMatch(/^[A-Z2-9]{4}$/);
    expect(typeof body.roomToken).toBe('string');
  });

  it('rejects room creation without an organizer token', async () => {
    const res = await worker.fetch(
      new Request('https://loveall.test/rooms', { method: 'POST' }),
      env
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd worker && npx vitest run test/rooms.test.js`
Expected: FAIL (module `../src/index.js` doesn't exist yet)

- [ ] **Step 3: Implement `SessionRoom` (init only for now)**

```js
// worker/src/session-room.js
export class SessionRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.viewers = new Set();
    this.organizerSocket = null;
    this.snapshot = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      const existing = await this.state.storage.get('creatorToken');
      if (existing) return new Response('already initialized', { status: 409 });
      const { creatorToken } = await request.json();
      await this.state.storage.put('creatorToken', creatorToken);
      return new Response('ok', { status: 200 });
    }

    return new Response('not found', { status: 404 });
  }
}
```

- [ ] **Step 4: Implement `worker/src/index.js` with the `/rooms` route**

```js
// worker/src/index.js
import { generateRoomCode } from './room-code.js';

export { SessionRoom } from './session-room.js';

function organizerToken(request) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

async function createRoom(request, env) {
  const creatorToken = organizerToken(request);
  if (!creatorToken) return new Response('missing organizer token', { status: 401 });

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const id = env.SESSION_ROOM.idFromName(code);
    const stub = env.SESSION_ROOM.get(id);
    const initRes = await stub.fetch('https://room/init', {
      method: 'POST',
      body: JSON.stringify({ creatorToken }),
    });
    if (initRes.status === 200) {
      return Response.json({ code, roomToken: creatorToken });
    }
    // 409 means this code is already taken; try another.
  }
  return new Response('could not allocate a room code', { status: 503 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/rooms' && request.method === 'POST') {
      return createRoom(request, env);
    }

    return new Response('not found', { status: 404 });
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd worker && npx vitest run test/rooms.test.js`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add worker/src/session-room.js worker/src/index.js worker/test/rooms.test.js
git commit -m "Add /rooms endpoint and SessionRoom Durable Object init"
```

---

### Task 3: Live WebSocket broadcast (organizer + viewers)

**Files:**
- Modify: `worker/src/session-room.js`
- Modify: `worker/src/index.js`
- Test: `worker/test/live-broadcast.test.js`

**Interfaces:**
- Consumes: `SessionRoom` from Task 2, room code/token from `POST /rooms`.
- Produces: `GET /rooms/:code/organizer?token=...` (WebSocket upgrade, write access) and `GET /rooms/:code/watch` (WebSocket upgrade, read-only) routes, used by the client sync module in Task 6 and the watch page in Task 8. Organizer messages are JSON `{ type: 'snapshot', state } | { type: 'completed', state }`. Viewer sockets receive the same JSON directly.

- [ ] **Step 1: Write the failing test for broadcast**

```js
// worker/test/live-broadcast.test.js
import { describe, it, expect } from 'vitest';
import worker from '../src/index.js';
import { env } from 'cloudflare:test';

async function createRoom() {
  const res = await worker.fetch(
    new Request('https://loveall.test/rooms', {
      method: 'POST',
      headers: { Authorization: 'Bearer organizer-1' },
    }),
    env
  );
  return res.json();
}

function connect(url) {
  const [client, server] = Object.values(new WebSocketPair());
  return { client, server, request: new Request(url, { headers: { Upgrade: 'websocket' } }) };
}

describe('live broadcast', () => {
  it('sends the current snapshot to a viewer on connect, then relays organizer updates', async () => {
    const { code, roomToken } = await createRoom();

    const organizerReq = new Request(
      `https://loveall.test/rooms/${code}/organizer?token=${roomToken}`,
      { headers: { Upgrade: 'websocket' } }
    );
    const organizerRes = await worker.fetch(organizerReq, env);
    expect(organizerRes.status).toBe(101);
    const organizerSocket = organizerRes.webSocket;
    organizerSocket.accept();
    organizerSocket.send(JSON.stringify({ type: 'snapshot', state: { round: 1 } }));

    // Give the Durable Object a tick to process the message before the viewer connects.
    await new Promise(r => setTimeout(r, 20));

    const viewerReq = new Request(`https://loveall.test/rooms/${code}/watch`, {
      headers: { Upgrade: 'websocket' },
    });
    const viewerRes = await worker.fetch(viewerReq, env);
    expect(viewerRes.status).toBe(101);
    const viewerSocket = viewerRes.webSocket;

    const firstMessage = await new Promise(resolve => {
      viewerSocket.addEventListener('message', e => resolve(JSON.parse(e.data)), { once: true });
      viewerSocket.accept();
    });
    expect(firstMessage).toEqual({ type: 'snapshot', state: { round: 1 } });

    const updatePromise = new Promise(resolve => {
      viewerSocket.addEventListener('message', e => resolve(JSON.parse(e.data)), { once: true });
    });
    organizerSocket.send(JSON.stringify({ type: 'snapshot', state: { round: 2 } }));
    expect(await updatePromise).toEqual({ type: 'snapshot', state: { round: 2 } });
  });

  it('rejects an organizer connection with the wrong token', async () => {
    const { code } = await createRoom();
    const res = await worker.fetch(
      new Request(`https://loveall.test/rooms/${code}/organizer?token=wrong`, {
        headers: { Upgrade: 'websocket' },
      }),
      env
    );
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd worker && npx vitest run test/live-broadcast.test.js`
Expected: FAIL (404 — no `/rooms/:code/*` route yet)

- [ ] **Step 3: Add WebSocket handling to `SessionRoom`**

```js
// worker/src/session-room.js
export class SessionRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.viewers = new Set();
    this.organizerSocket = null;
    this.snapshot = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      const existing = await this.state.storage.get('creatorToken');
      if (existing) return new Response('already initialized', { status: 409 });
      const { creatorToken } = await request.json();
      await this.state.storage.put('creatorToken', creatorToken);
      return new Response('ok', { status: 200 });
    }

    if (url.pathname === '/organizer') {
      const token = url.searchParams.get('token');
      const creatorToken = await this.state.storage.get('creatorToken');
      if (token !== creatorToken) return new Response('forbidden', { status: 403 });

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.organizerSocket = server;
      server.addEventListener('message', event => this.handleOrganizerMessage(event));
      server.addEventListener('close', () => {
        if (this.organizerSocket === server) this.organizerSocket = null;
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/watch') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      server.accept();
      this.viewers.add(server);
      server.addEventListener('close', () => this.viewers.delete(server));
      if (this.snapshot) server.send(JSON.stringify(this.snapshot));
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('not found', { status: 404 });
  }

  async handleOrganizerMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return; // ignore malformed frames
    }
    if (message.type !== 'snapshot' && message.type !== 'completed') return;

    this.snapshot = message;
    for (const viewer of this.viewers) {
      try {
        viewer.send(event.data);
      } catch {
        this.viewers.delete(viewer);
      }
    }

    if (message.type === 'completed') {
      await this.persistHistory(message.state);
    }
  }

  async persistHistory(_state) {
    // Implemented in Task 4.
  }
}
```

- [ ] **Step 4: Add the room routes to `worker/src/index.js`**

```js
// worker/src/index.js — replace the default export's fetch body
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/rooms' && request.method === 'POST') {
      return createRoom(request, env);
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([A-Z2-9]{4})\/(organizer|watch)$/);
    if (roomMatch) {
      const [, code] = roomMatch;
      const id = env.SESSION_ROOM.idFromName(code);
      const stub = env.SESSION_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('not found', { status: 404 });
  },
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd worker && npx vitest run test/live-broadcast.test.js`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add worker/src/session-room.js worker/src/index.js worker/test/live-broadcast.test.js
git commit -m "Add organizer/viewer WebSocket routes with live broadcast"
```

---

### Task 4: D1 history persistence + `/history` endpoint

**Files:**
- Create: `worker/schema.sql`
- Modify: `worker/src/session-room.js` (implement `persistHistory`)
- Modify: `worker/src/index.js` (add `GET /history`)
- Test: `worker/test/history.test.js`

**Interfaces:**
- Consumes: `message.state` passed into `persistHistory` (Task 3), D1 binding `env.DB`.
- Produces: `GET /history` (Bearer token) → `[{ id, completedAt, standingsJson }]`, used by the client History view in Task 9.

- [ ] **Step 1: Write the D1 schema**

```sql
-- worker/schema.sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  organizer_token TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  standings_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_organizer
  ON sessions (organizer_token, completed_at DESC);
```

Apply locally for tests/dev: `cd worker && npx wrangler d1 execute loveall_history --local --file=./schema.sql`

- [ ] **Step 2: Write the failing test for history persistence**

```js
// worker/test/history.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index.js';
import { env } from 'cloudflare:test';
import fs from 'node:fs';
import path from 'node:path';

beforeAll(async () => {
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) {
    await env.DB.prepare(statement).run();
  }
});

async function createRoom(token) {
  const res = await worker.fetch(
    new Request('https://loveall.test/rooms', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );
  return res.json();
}

describe('history', () => {
  it('writes a row on completion and returns it from GET /history', async () => {
    const { code, roomToken } = await createRoom('organizer-42');

    const organizerRes = await worker.fetch(
      new Request(`https://loveall.test/rooms/${code}/organizer?token=${roomToken}`, {
        headers: { Upgrade: 'websocket' },
      }),
      env
    );
    const organizerSocket = organizerRes.webSocket;
    organizerSocket.accept();
    organizerSocket.send(JSON.stringify({
      type: 'completed',
      state: { standings: [{ name: 'Aldo', wins: 5 }] },
    }));
    await new Promise(r => setTimeout(r, 20));

    const historyRes = await worker.fetch(
      new Request('https://loveall.test/history', {
        headers: { Authorization: 'Bearer organizer-42' },
      }),
      env
    );
    expect(historyRes.status).toBe(200);
    const rows = await historyRes.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].standingsJson).toEqual([{ name: 'Aldo', wins: 5 }]);
  });

  it('requires an organizer token for GET /history', async () => {
    const res = await worker.fetch(new Request('https://loveall.test/history'), env);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd worker && npx vitest run test/history.test.js`
Expected: FAIL — `/history` returns 404, and `persistHistory` is a no-op

- [ ] **Step 4: Implement `persistHistory` in `SessionRoom`**

```js
// worker/src/session-room.js — replace the persistHistory stub
async persistHistory(state) {
  const creatorToken = await this.state.storage.get('creatorToken');
  await this.env.DB.prepare(
    'INSERT INTO sessions (id, organizer_token, completed_at, standings_json) VALUES (?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), creatorToken, Date.now(), JSON.stringify(state.standings ?? state)).run();
}
```

- [ ] **Step 5: Add `GET /history` to `worker/src/index.js`**

```js
// worker/src/index.js — add alongside createRoom
async function getHistory(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer (.+)$/);
  if (!match) return new Response('missing organizer token', { status: 401 });

  const { results } = await env.DB.prepare(
    'SELECT id, completed_at, standings_json FROM sessions WHERE organizer_token = ? ORDER BY completed_at DESC LIMIT 50'
  ).bind(match[1]).all();

  const rows = results.map(r => ({
    id: r.id,
    completedAt: r.completed_at,
    standingsJson: JSON.parse(r.standings_json),
  }));
  return Response.json(rows);
}
```

And add the route inside `fetch`:

```js
    if (url.pathname === '/history' && request.method === 'GET') {
      return getHistory(request, env);
    }
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd worker && npx vitest run test/history.test.js`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add worker/schema.sql worker/src/session-room.js worker/src/index.js worker/test/history.test.js
git commit -m "Persist completed sessions to D1 and expose GET /history"
```

---

### Task 5: Organizer token in the client

**Files:**
- Modify: `src/persistence.js`
- Test: `tests/persistence.test.js` (new)

**Interfaces:**
- Produces: `getOrganizerToken(): string` — reads-or-creates `loveall:organizerToken` in `localStorage`, used by `src/sync.js` in Task 6.

- [ ] **Step 1: Write the failing test**

```js
// tests/persistence.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

function makeMemoryStorage() {
  const store = new Map();
  return {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  };
}

test('getOrganizerToken creates a token once and reuses it thereafter', async () => {
  globalThis.localStorage = makeMemoryStorage();
  globalThis.crypto = globalThis.crypto ?? (await import('node:crypto')).webcrypto;
  const { getOrganizerToken } = await import('../src/persistence.js?t=' + Date.now());

  const first = getOrganizerToken();
  const second = getOrganizerToken();
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f-]{36}$/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL with "getOrganizerToken is not a function" (or export not found)

- [ ] **Step 3: Add `getOrganizerToken` to `src/persistence.js`**

```js
// src/persistence.js — add near the other *_KEY helpers
const ORGANIZER_TOKEN_KEY = 'loveall:organizerToken';

export function getOrganizerToken() {
  let token = localStorage.getItem(ORGANIZER_TOKEN_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(ORGANIZER_TOKEN_KEY, token);
  }
  return token;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/persistence.js tests/persistence.test.js
git commit -m "Add silent per-device organizer token for sync/history auth"
```

---

### Task 6: Client sync module (`src/sync.js`)

**Files:**
- Create: `src/sync.js`
- Test: `tests/sync.test.js`

**Interfaces:**
- Consumes: `getOrganizerToken()` from Task 5. Talks to the Worker routes from Tasks 2–3: `POST /rooms`, `GET /rooms/:code/organizer?token=`.
- Produces: `createSyncClient(workerUrl): SyncClient` where `SyncClient` has:
  - `goLive(): Promise<{ code: string, watchUrl: string }>`
  - `push(state: object): void` (debounced, best-effort, fire-and-forget)
  - `complete(state: object): void` (sends immediately, then closes)
  - `onStatus(cb: (status: 'idle'|'connecting'|'live'|'offline') => void): void`
  - `stop(): void`

  Used by `src/ui/live.js` in Task 7.

- [ ] **Step 1: Write the failing tests**

```js
// tests/sync.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeWebSocket {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.readyState = 0; // CONNECTING
    FakeWebSocket.instances.push(this);
  }
  send(data) { this.sent.push(data); }
  close() { this.readyState = 3; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
}

function fakeFetchReturning(body, status = 200) {
  return async () => ({ ok: status < 300, status, json: async () => body });
}

test('goLive posts to /rooms with the organizer token and opens a websocket', async () => {
  globalThis.localStorage = { store: new Map(), getItem(k) { return this.store.get(k) ?? null; }, setItem(k, v) { this.store.set(k, v); } };
  globalThis.crypto = globalThis.crypto ?? (await import('node:crypto')).webcrypto;
  globalThis.WebSocket = FakeWebSocket;
  globalThis.fetch = fakeFetchReturning({ code: 'AB3D', roomToken: 'organizer-token' });

  const { createSyncClient } = await import('../src/sync.js?t=' + Date.now());
  const client = createSyncClient('https://loveall.example');

  const result = await client.goLive();
  assert.equal(result.code, 'AB3D');
  assert.equal(result.watchUrl, 'https://loveall.example/watch/AB3D');
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.match(FakeWebSocket.instances[0].url, /\/rooms\/AB3D\/organizer\?token=/);
});

test('push debounces and sends the latest snapshot as JSON', async () => {
  globalThis.localStorage = { store: new Map(), getItem(k) { return this.store.get(k) ?? null; }, setItem(k, v) { this.store.set(k, v); } };
  globalThis.WebSocket = FakeWebSocket;
  globalThis.fetch = fakeFetchReturning({ code: 'ZZ99', roomToken: 'organizer-token' });

  const { createSyncClient } = await import('../src/sync.js?t=' + Date.now());
  const client = createSyncClient('https://loveall.example');
  await client.goLive();
  const socket = FakeWebSocket.instances.at(-1);
  socket.open();

  client.push({ round: 1 });
  client.push({ round: 2 });
  await new Promise(r => setTimeout(r, 450));

  assert.equal(socket.sent.length, 1);
  assert.deepEqual(JSON.parse(socket.sent[0]), { type: 'snapshot', state: { round: 2 } });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL with "Cannot find module '../src/sync.js'"

- [ ] **Step 3: Implement `src/sync.js`**

```js
// src/sync.js
import { getOrganizerToken } from './persistence.js';

const PUSH_DEBOUNCE_MS = 400;

export function createSyncClient(workerUrl) {
  let socket = null;
  let code = null;
  let pendingState = null;
  let debounceTimer = null;
  let statusCb = () => {};

  function setStatus(status) {
    statusCb(status);
  }

  async function goLive() {
    setStatus('connecting');
    const res = await fetch(`${workerUrl}/rooms`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getOrganizerToken()}` },
    });
    if (!res.ok) {
      setStatus('offline');
      throw new Error(`Failed to create room: ${res.status}`);
    }
    const body = await res.json();
    code = body.code;

    const wsUrl = `${workerUrl.replace(/^http/, 'ws')}/rooms/${code}/organizer?token=${body.roomToken}`;
    socket = new WebSocket(wsUrl);
    socket.onopen = () => setStatus('live');
    socket.onclose = () => setStatus('offline');
    socket.onerror = () => setStatus('offline');

    return { code, watchUrl: `${workerUrl}/watch/${code}` };
  }

  function flush() {
    debounceTimer = null;
    if (!socket || socket.readyState !== 1 || pendingState === null) return;
    try {
      socket.send(JSON.stringify({ type: 'snapshot', state: pendingState }));
    } catch {
      setStatus('offline');
    }
    pendingState = null;
  }

  function push(state) {
    pendingState = state;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, PUSH_DEBOUNCE_MS);
  }

  function complete(state) {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (socket && socket.readyState === 1) {
      try {
        socket.send(JSON.stringify({ type: 'completed', state }));
      } catch {
        /* best-effort */
      }
    }
    stop();
  }

  function stop() {
    if (debounceTimer) clearTimeout(debounceTimer);
    socket?.close();
    socket = null;
  }

  function onStatus(cb) {
    statusCb = cb;
  }

  return { goLive, push, complete, stop, onStatus };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/sync.js tests/sync.test.js
git commit -m "Add opt-in client sync module for live room broadcast"
```

---

### Task 7: "Share live" control in the live-play screen

**Files:**
- Create: `src/config.js`
- Modify: `src/ui/live.js`
- Modify: `styles.css` (small addition for the status dot; follow existing class-naming style in that file)

**Interfaces:**
- Consumes: `createSyncClient(workerUrl)` from Task 6.
- Produces: `WORKER_URL` exported from `src/config.js`, reused by Task 8 and Task 9 instead of each redeclaring it.

- [ ] **Step 1: Read the current header markup in `src/ui/live.js`**

Run: `grep -n "screen-header\|header-actions" src/ui/live.js`

(This locates the existing header-actions button group so the new button matches existing markup conventions before editing.)

- [ ] **Step 2: Add a "Go live" button and status dot to the header actions**

Add a button beside the existing theme toggle in the `header-actions` block:

```html
<button class="icon-btn" id="share-live-btn" type="button" aria-label="share live">📡</button>
<span class="live-status-dot" id="live-status-dot" hidden></span>
```

- [ ] **Step 3: Create `src/config.js`**

```js
// src/config.js
// Set to the deployed worker origin once Task 10's `wrangler deploy` runs.
export const WORKER_URL = 'https://loveall-sync.example.workers.dev';
```

- [ ] **Step 4: Wire the button in the render function**

```js
// src/ui/live.js — near the top of the module
import { createSyncClient } from '../sync.js';
import { WORKER_URL } from '../config.js';

// Inside renderLive(root, go, session), after root.innerHTML is set:
const syncClient = createSyncClient(WORKER_URL);
const statusDot = root.querySelector('#live-status-dot');
syncClient.onStatus(status => {
  statusDot.hidden = status === 'idle';
  statusDot.dataset.status = status;
});

root.querySelector('#share-live-btn').onclick = async () => {
  try {
    const { watchUrl } = await syncClient.goLive();
    if (navigator.share) {
      await navigator.share({ title: 'Watch live scores', url: watchUrl });
    } else {
      await navigator.clipboard.writeText(watchUrl);
      alert(`Link copied: ${watchUrl}`);
    }
  } catch (e) {
    console.warn('Could not go live', e);
    alert('Could not start live sharing — check your connection and try again.');
  }
};

// After every applyScore/state mutation already present in this file, add:
syncClient.push(session);
```

- [ ] **Step 5: Add the status dot style to `styles.css`**

```css
.live-status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--muted, #999); }
.live-status-dot[data-status="live"] { background: #2fa84f; }
.live-status-dot[data-status="connecting"] { background: #d9a441; }
.live-status-dot[data-status="offline"] { background: #c0392b; }
```

- [ ] **Step 6: Manually verify**

Run: `npm run serve`, open the app on a phone/laptop, start a session, tap the share-live button, confirm no console errors and that the status dot appears (it will show "offline" until the worker is deployed — that's expected until Task 10's manual deploy).

- [ ] **Step 7: Commit**

```bash
git add src/config.js src/ui/live.js styles.css
git commit -m "Wire a Share live control into the live-play screen"
```

---

### Task 8: Read-only watch page

**Files:**
- Create: `watch.html`
- Create: `src/watch-app.js`

**Interfaces:**
- Consumes: `buildStandings(state)` and `formatDiff(n)`, already exported from `src/recap-card.js` (no changes needed there — the existing recap template is a bespoke full-screen card, not a generic component, so this task writes its own small read-only markup rather than forcing reuse of `renderSummary`). Also consumes `WORKER_URL` from `src/config.js` (Task 7).
- Produces: nothing consumed elsewhere; this is a leaf page.

- [ ] **Step 1: Create `watch.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LoveAll — watching live</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="watch-root">
    <p>Connecting…</p>
  </div>
  <script type="module" src="src/watch-app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Implement `src/watch-app.js`**

```js
// src/watch-app.js
import { buildStandings, formatDiff } from './recap-card.js';
import { WORKER_URL } from './config.js';

const root = document.getElementById('watch-root');
const code = location.pathname.split('/').pop();

function render(state) {
  const { ranked } = buildStandings(state);
  root.innerHTML = `
    <h1>Live standings</h1>
    <ol>
      ${ranked.map(p => `<li>${p.name} — ${p.wins}W ${p.losses}L (${formatDiff(p.gameDiff)})</li>`).join('')}
    </ol>
  `;
}

function connect() {
  const wsUrl = `${WORKER_URL.replace(/^http/, 'ws')}/rooms/${code}/watch`;
  const socket = new WebSocket(wsUrl);
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    render(message.state);
  };
  socket.onclose = () => {
    root.innerHTML = '<p>Connection lost. This session may have ended.</p>';
  };
  socket.onerror = () => {
    root.innerHTML = '<p>Could not connect. The link may be invalid or expired.</p>';
  };
}

connect();
```

- [ ] **Step 3: Manually verify**

Run: `npm run serve`, open `http://localhost:8000/watch/TEST` in a second tab. Expected: "Could not connect" message (no worker deployed yet locally) with no thrown JS errors in the console — confirms the page loads and fails gracefully. Full live verification happens in Task 10 once the worker is deployed.

- [ ] **Step 4: Commit**

```bash
git add watch.html src/watch-app.js
git commit -m "Add a read-only watch page for spectator links"
```

---

### Task 9: History view

**Files:**
- Create: `src/ui/history.js`
- Modify: `src/router.js`
- Modify: `src/ui/settings.js`

**Interfaces:**
- Consumes: `GET /history` from Task 4, `getOrganizerToken()` from Task 5, `WORKER_URL` from `src/config.js` (Task 7).
- Produces: `renderHistory(root, go)`, registered as the `'history'` screen in `router.js`.

- [ ] **Step 1: Add the `history` screen to `src/router.js`**

```js
// src/router.js
import { renderHistory } from './ui/history.js';
// ...in the switch statement:
    case 'history': return renderHistory(root(), go);
```

- [ ] **Step 2: Implement `src/ui/history.js`**

```js
// src/ui/history.js
import { getOrganizerToken } from '../persistence.js';
import { WORKER_URL } from '../config.js';

export async function renderHistory(root, go) {
  root.innerHTML = `
    <div class="screen-header">
      <button class="icon-btn" id="back-btn" type="button" aria-label="back">←</button>
      <div class="title">Session history</div>
    </div>
    <div id="history-list"><p>Loading…</p></div>
  `;
  root.querySelector('#back-btn').onclick = () => go('setup');

  const list = root.querySelector('#history-list');
  try {
    const res = await fetch(`${WORKER_URL}/history`, {
      headers: { Authorization: `Bearer ${getOrganizerToken()}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const rows = await res.json();
    if (rows.length === 0) {
      list.innerHTML = '<p>No past sessions yet.</p>';
      return;
    }
    list.innerHTML = `
      <ul class="history-list">
        ${rows.map(row => `
          <li>
            <span>${new Date(row.completedAt).toLocaleDateString()}</span>
            <span>${row.standingsJson[0]?.name ?? '—'} won</span>
          </li>
        `).join('')}
      </ul>
    `;
  } catch (e) {
    console.warn('Could not load history', e);
    list.innerHTML = '<p>Could not load history. Check your connection and try again.</p>';
  }
}
```

- [ ] **Step 3: Add a link to History from Settings**

Run: `grep -n "screen-header\|button" src/ui/settings.js` to match existing button markup, then add:

```html
<button class="btn" id="history-btn" type="button">Session history</button>
```

```js
// src/ui/settings.js — alongside other button wiring
root.querySelector('#history-btn').onclick = () => go('history');
```

- [ ] **Step 4: Manually verify**

Run: `npm run serve`, open the app, go to Settings, tap "Session history". Expected: "Could not load history" (no worker deployed yet) rendered without console errors — confirms wiring is correct pending Task 10's deploy.

- [ ] **Step 5: Commit**

```bash
git add src/router.js src/ui/history.js src/ui/settings.js
git commit -m "Add a session history view backed by the worker's GET /history"
```

---

### Task 10: Deploy and end-to-end smoke test

**Files:**
- Modify: `README.md`

This task is mostly manual (requires the user's own Cloudflare account) — the agent should perform Step 1 (documentation) and then hand the remaining steps to the user rather than attempting them without credentials.

- [ ] **Step 1: Document the deploy steps in `README.md`**

```markdown
## Deploying the live-sync worker

1. `cd worker && npx wrangler login`
2. `npx wrangler d1 create loveall_history` — copy the returned `database_id` into `worker/wrangler.toml`
3. `npx wrangler d1 execute loveall_history --remote --file=./schema.sql`
4. `npx wrangler deploy` — note the deployed worker URL
5. Replace `WORKER_URL` in `src/config.js` with that URL
6. Redeploy the static site as usual (no build step)
```

- [ ] **Step 2 (user, manual): Run the deploy steps above against your own Cloudflare account.**

- [ ] **Step 3 (user, manual): Two-browser smoke test**

- Open the app on phone A, start a session, tap "Share live", copy the link.
- Open the link on phone/laptop B's browser (no install).
- Score a round on phone A. Expected: standings update on B within ~1 second.
- End the session on A. Expected: Settings → Session history on A shows the completed session.

- [ ] **Step 4: Commit the README update**

```bash
git add README.md
git commit -m "Document Cloudflare worker deploy steps for live sync"
```
