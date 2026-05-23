const KEY = 'court-shuffle:session';
const DARK_KEY = 'court-shuffle:dark';

export function saveSession(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save session', e);
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load session', e);
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export function saveDarkMode(on) {
  localStorage.setItem(DARK_KEY, on ? '1' : '0');
}

export function loadDarkMode() {
  return localStorage.getItem(DARK_KEY) === '1';
}

const ROSTER_KEY = 'court-shuffle:lastRoster';

export function saveLastRoster(players) {
  try {
    // Strip ids so reuse creates fresh ids in setup
    const roster = players.map(p => ({ name: p.name, seedSkill: p.seedSkill }));
    localStorage.setItem(ROSTER_KEY, JSON.stringify(roster));
  } catch (e) {
    console.error('Failed to save roster', e);
  }
}

export function loadLastRoster() {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch (e) {
    return null;
  }
}
