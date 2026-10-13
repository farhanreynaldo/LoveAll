import { go } from './router.js';
import { initTheme, toggleDarkMode } from './theme.js';
import { loadSession } from './persistence.js';
import { track } from './funnel.js';

initTheme();
track('visit', { source: new URLSearchParams(location.search).get('utm_source') || 'direct' });

// Global dark-mode toggle: any element marked [data-theme-toggle] flips the theme.
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-theme-toggle]');
  if (!btn) return;
  toggleDarkMode();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('Service worker registration failed', err);
    });
  });
}

const session = loadSession();
if (!session) {
  go('setup');
} else if (session.mode === 'adaptive') {
  go(session.endedAt ? 'summary' : 'adaptive-live', session);
} else {
  const allDone = session.schedule.every(r => r.status === 'completed');
  // session.endedAt covers an early end (before all rounds were played);
  // allDone covers finishing every round without explicitly tapping "End
  // session." Either means the session is over and belongs on the recap.
  if (allDone || session.endedAt) go('summary', session);
  else go('live', session);
}
