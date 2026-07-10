import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index.js';
import { env } from 'cloudflare:test';
import schema from '../schema.sql?raw';

beforeAll(async () => {
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
