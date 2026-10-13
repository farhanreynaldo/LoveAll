import { getOrganizerToken, loadLocalHistory } from '../persistence.js';
import { WORKER_URL } from '../config.js';

// The local archive (this device) is the source of truth and renders
// immediately, so history works fully offline. The server fetch only adds
// sessions completed on other devices; failing to reach it is not an
// error state as long as local history has something to show.
//
// `session` is the in-progress session this screen was reached through
// (settings.js passes it along). Back must return to it, not fall through
// to a blank setup screen: setup's "Start session" overwrites the single
// persisted session slot with no confirmation, so landing there while a
// live session still exists risks silently discarding it (see
// docs/2026-07-18-ui-ux-complaint-audit.md, finding 5). Only when there's
// no session to return to (a hypothetical future entry point into history
// outside the live→settings→history chain) does back fall back to setup.
export async function renderHistory(root, go, session) {
  root.innerHTML = `
    <div class="screen-header">
      <button class="icon-btn" id="back-btn" type="button" aria-label="back">←</button>
      <div class="title">Session history</div>
    </div>
    <div id="history-list"><p>Loading…</p></div>
  `;
  root.querySelector('#back-btn').onclick = () =>
    session ? go('settings', session) : go('setup');

  const list = root.querySelector('#history-list');
  const local = loadLocalHistory();
  render(mergeRows(local, []));

  try {
    const res = await fetch(`${WORKER_URL}/history`, {
      headers: { Authorization: `Bearer ${getOrganizerToken()}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const remote = await res.json();
    render(mergeRows(local, remote), { remoteOk: true });
  } catch (e) {
    console.warn('Could not reach server for cross-device history; showing this device only', e);
    render(mergeRows(local, []), { remoteOk: false });
  }

  function mergeRows(localRows, remoteRows) {
    const byId = new Map();
    for (const r of remoteRows) {
      byId.set(r.id, { id: r.id, completedAt: r.completedAt, standings: r.standingsJson });
    }
    // Local wins on id conflict: it reflects this device's own state and
    // may be fresher than whatever last made it to the server.
    for (const r of localRows) byId.set(r.id, r);
    return [...byId.values()].sort((a, b) => b.completedAt - a.completedAt);
  }

  function render(rows, { remoteOk = null } = {}) {
    if (rows.length > 0) {
      list.innerHTML = `
        <ul class="history-list">
          ${rows.map(row => `
            <li>
              <span>${escapeHtml(row.groupName || new Date(row.completedAt).toLocaleDateString())}</span>
              <span>${escapeHtml(row.standings?.[0]?.name ?? '—')} won</span>
            </li>
          `).join('')}
        </ul>
      `;
      return;
    }
    list.innerHTML = remoteOk === false
      ? '<p>No sessions on this device yet. Could not check for sessions from other devices — check your connection.</p>'
      : '<p>No past sessions yet.</p>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
}
