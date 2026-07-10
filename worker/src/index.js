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
    await initRes.text();
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
