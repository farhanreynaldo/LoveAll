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
  if (!globalThis.crypto) {
    globalThis.crypto = (await import('node:crypto')).webcrypto;
  }
  globalThis.WebSocket = FakeWebSocket;
  globalThis.fetch = fakeFetchReturning({ code: 'AB3D', roomToken: 'organizer-token' });
  // Subpath deployment (e.g. a GitHub Pages project site) — watchUrl must
  // preserve the /LoveAll/ prefix, not just the origin.
  globalThis.location = { origin: 'https://loveall.example', href: 'https://loveall.example/LoveAll/' };

  const { createSyncClient } = await import('../src/sync.js?t=' + Date.now());
  const client = createSyncClient('https://loveall.example');

  const result = await client.goLive();
  assert.equal(result.code, 'AB3D');
  assert.equal(result.watchUrl, 'https://loveall.example/LoveAll/watch.html?code=AB3D');
  assert.equal(FakeWebSocket.instances.length, 1);
  assert.match(FakeWebSocket.instances[0].url, /\/rooms\/AB3D\/organizer\?token=/);
});

test('push debounces and sends the latest snapshot as JSON', async () => {
  globalThis.localStorage = { store: new Map(), getItem(k) { return this.store.get(k) ?? null; }, setItem(k, v) { this.store.set(k, v); } };
  globalThis.WebSocket = FakeWebSocket;
  globalThis.fetch = fakeFetchReturning({ code: 'ZZ99', roomToken: 'organizer-token' });
  globalThis.location = { origin: 'https://loveall.example', href: 'https://loveall.example/' };

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
