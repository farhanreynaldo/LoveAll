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
