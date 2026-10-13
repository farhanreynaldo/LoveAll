const KEY = 'loveall:funnel';
const EVENTS = new Set(['visit', 'session_started', 'first_match', 'session_completed', 'return_session']);

export function track(event, details = {}) {
  if (!EVENTS.has(event)) throw new Error(`Unknown funnel event: ${event}`);
  try {
    const rows = readFunnel();
    rows.push({ event, at: Date.now(), ...details });
    localStorage.setItem(KEY, JSON.stringify(rows.slice(-200)));
  } catch (error) {
    console.warn('Could not record funnel event', error);
  }
}

export function readFunnel() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}
