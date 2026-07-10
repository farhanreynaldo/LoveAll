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
