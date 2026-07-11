import { getOrganizerToken } from '../persistence.js';
import { WORKER_URL } from '../config.js';

export async function renderHistory(root, go) {
  root.innerHTML = `
    <div class="screen-header">
      <button class="icon-btn" id="back-btn" type="button" aria-label="back">←</button>
      <div class="title">Session history</div>
    </div>
    <div id="history-list"><p>Loading…</p></div>
  `;
  root.querySelector('#back-btn').onclick = () => go('setup');

  const list = root.querySelector('#history-list');
  try {
    const res = await fetch(`${WORKER_URL}/history`, {
      headers: { Authorization: `Bearer ${getOrganizerToken()}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const rows = await res.json();
    if (rows.length === 0) {
      list.innerHTML = '<p>No past sessions yet.</p>';
      return;
    }
    list.innerHTML = `
      <ul class="history-list">
        ${rows.map(row => `
          <li>
            <span>${new Date(row.completedAt).toLocaleDateString()}</span>
            <span>${escapeHtml(row.standingsJson[0]?.name ?? '—')} won</span>
          </li>
        `).join('')}
      </ul>
    `;
  } catch (e) {
    console.warn('Could not load history', e);
    list.innerHTML = '<p>Could not load history. Check your connection and try again.</p>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
}
