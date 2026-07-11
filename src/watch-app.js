// src/watch-app.js
import { buildStandings, formatDiff } from './recap-card.js';
import { WORKER_URL } from './config.js';

const root = document.getElementById('watch-root');
const code = location.pathname.split('/').pop();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render(state) {
  const { ranked } = buildStandings(state);
  root.innerHTML = `
    <h1>Live standings</h1>
    <ol>
      ${ranked.map(p => `<li>${escapeHtml(p.name)} — ${p.wins}W ${p.losses}L (${formatDiff(p.gameDiff)})</li>`).join('')}
    </ol>
  `;
}

function connect() {
  const wsUrl = `${WORKER_URL.replace(/^http/, 'ws')}/rooms/${code}/watch`;
  const socket = new WebSocket(wsUrl);
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    render(message.state);
  };
  socket.onclose = () => {
    root.innerHTML = '<p>Connection lost. This session may have ended.</p>';
  };
  socket.onerror = () => {
    root.innerHTML = '<p>Could not connect. The link may be invalid or expired.</p>';
  };
}

connect();
