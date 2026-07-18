import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index.js';
import { env } from 'cloudflare:test';
import schema from '../schema.sql?raw';

beforeAll(async () => {
  for (const statement of schema.split(';').map(s => s.trim()).filter(Boolean)) {
    await env.DB.prepare(statement).run();
  }
});

function postHistory(token, body) {
  return worker.fetch(
    new Request('https://loveall.test/history', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env
  );
}

function getHistory(token) {
  return worker.fetch(
    new Request('https://loveall.test/history', {
      headers: { Authorization: `Bearer ${token}` },
    }),
    env
  );
}

describe('history', () => {
  it('POST /history writes a row, independent of any live room', async () => {
    const res = await postHistory('organizer-42', {
      id: 'session-1',
      completedAt: Date.now(),
      standings: [{ name: 'Aldo', wins: 5 }],
    });
    expect(res.status).toBe(200);

    const historyRes = await getHistory('organizer-42');
    expect(historyRes.status).toBe(200);
    const rows = await historyRes.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].standingsJson).toEqual([{ name: 'Aldo', wins: 5 }]);
  });

  it('POST /history is idempotent for a retried id (no duplicate rows)', async () => {
    const entry = { id: 'session-2', completedAt: Date.now(), standings: [{ name: 'Bo', wins: 3 }] };
    await postHistory('organizer-43', entry);
    await postHistory('organizer-43', entry); // simulated retry after an unconfirmed first attempt

    const rows = await (await getHistory('organizer-43')).json();
    expect(rows).toHaveLength(1);
  });

  it('POST /history requires an organizer token', async () => {
    const res = await worker.fetch(
      new Request('https://loveall.test/history', {
        method: 'POST',
        body: JSON.stringify({ id: 'x', completedAt: Date.now(), standings: [] }),
      }),
      env
    );
    expect(res.status).toBe(401);
  });

  it('POST /history rejects a body missing required fields', async () => {
    const res = await postHistory('organizer-44', { completedAt: Date.now() });
    expect(res.status).toBe(400);
  });

  it('requires an organizer token for GET /history', async () => {
    const res = await worker.fetch(new Request('https://loveall.test/history'), env);
    expect(res.status).toBe(401);
  });
});
