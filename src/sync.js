import { getOrganizerToken } from './persistence.js';

const PUSH_DEBOUNCE_MS = 400;

// Decoupled from the live room entirely: this is a plain, best-effort POST
// so a session's history entry reaches the server whether or not the
// organizer ever went live. The local archive (persistence.js) is the
// source of truth; this is purely a cross-device convenience and is safe
// to fail silently (offline, server down, etc.) since nothing depends on
// it succeeding.
export async function saveHistory(workerUrl, entry) {
  try {
    await fetch(`${workerUrl}/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getOrganizerToken()}`,
      },
      body: JSON.stringify(entry),
    });
  } catch (e) {
    console.warn('Could not sync history to server', e);
  }
}

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
    socket.onopen = () => { setStatus('live'); flush(); };
    socket.onclose = () => setStatus('offline');
    socket.onerror = () => setStatus('offline');

    return { code, watchUrl: new URL(`watch.html?code=${code}`, location.href).href };
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
