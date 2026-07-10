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

    organizerSocket.close();
    viewerSocket.close();
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
    res.webSocket?.close();
  });
});
