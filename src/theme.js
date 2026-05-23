import { saveDarkMode, loadDarkMode } from './persistence.js';

export function applyTheme(on) {
  document.body.classList.toggle('dark', on);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', on ? '#0a0e1a' : '#fafaf7');
}

export function initTheme() {
  const on = loadDarkMode();
  applyTheme(on);
  return on;
}

export function toggleDarkMode() {
  const on = !document.body.classList.contains('dark');
  applyTheme(on);
  saveDarkMode(on);
  return on;
}
