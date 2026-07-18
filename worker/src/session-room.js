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
      server.addEventListener('message', event => {
        this.handleOrganizerMessage(event);
      });
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
    // Durable history is written by the client directly via POST /history
    // (see index.js#saveHistory), decoupled from whether a live room ever
    // existed. This room only relays live state to connected watchers.
  }
}
