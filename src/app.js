import { go } from './router.js';
import { initTheme } from './theme.js';
import { loadSession } from './persistence.js';

initTheme();

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
} else {
  const allDone = session.schedule.every(r => r.status === 'completed');
  if (allDone) go('summary', session);
  else go('live', session);
}
