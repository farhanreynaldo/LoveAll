const KEY = 'loveall:session';
const DARK_KEY = 'loveall:dark';

// One-time rename from the old "court-shuffle:*" namespace. Safe to leave in
// indefinitely; it's a no-op once the old keys are gone.
function migrateKey(oldKey, newKey) {
  try {
    if (localStorage.getItem(newKey) !== null) {
      localStorage.removeItem(oldKey);
      return;
    }
    const v = localStorage.getItem(oldKey);
    if (v !== null) {
      localStorage.setItem(newKey, v);
      localStorage.removeItem(oldKey);
    }
  } catch (e) { /* localStorage unavailable; ignore */ }
}
migrateKey('court-shuffle:session', KEY);
migrateKey('court-shuffle:dark', DARK_KEY);
migrateKey('court-shuffle:lastRoster', 'loveall:lastRoster');

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

const ROSTER_KEY = 'loveall:lastRoster';

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
