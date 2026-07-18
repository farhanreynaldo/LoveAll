import { generateRoomCode } from './room-code.js';

export { SessionRoom } from './session-room.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) headers.set(key, value);
  return new Response(response.body, { status: response.status, headers });
}

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

async function saveHistory(request, env) {
  const token = organizerToken(request);
  if (!token) return new Response('missing organizer token', { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('invalid body', { status: 400 });
  }
  const { id, completedAt, standings } = body ?? {};
  if (!id || !completedAt || !standings) {
    return new Response('missing id, completedAt, or standings', { status: 400 });
  }

  // INSERT OR IGNORE: the client may retry the same entry (e.g. after a
  // reload before confirming success), and id is the client-generated
  // dedupe key, so a retry must be a no-op, not a duplicate row.
  await env.DB.prepare(
    'INSERT OR IGNORE INTO sessions (id, organizer_token, completed_at, standings_json) VALUES (?, ?, ?, ?)'
  ).bind(id, token, completedAt, JSON.stringify(standings)).run();

  return new Response('ok', { status: 200 });
}

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (url.pathname === '/rooms' && request.method === 'POST') {
      return withCors(await createRoom(request, env));
    }

    if (url.pathname === '/history' && request.method === 'GET') {
      return withCors(await getHistory(request, env));
    }

    if (url.pathname === '/history' && request.method === 'POST') {
      return withCors(await saveHistory(request, env));
    }

    const roomMatch = url.pathname.match(/^\/rooms\/([A-Z2-9]{4})\/(organizer|watch)$/);
    if (roomMatch) {
      const [, code, route] = roomMatch;
      const id = env.SESSION_ROOM.idFromName(code);
      const stub = env.SESSION_ROOM.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.pathname = `/${route}`;
      return stub.fetch(new Request(forwardUrl, request));
    }

    return new Response('not found', { status: 404 });
  },
};
