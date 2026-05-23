import { renderSetup } from './ui/setup.js';
import { renderLive } from './ui/live.js';
import { renderSummary } from './ui/summary.js';
import { renderSettings } from './ui/settings.js';

const root = () => document.getElementById('app');

export function go(screen, ...args) {
  root().innerHTML = '';
  switch (screen) {
    case 'setup':    return renderSetup(root(), go);
    case 'live':     return renderLive(root(), go, ...args);
    case 'summary':  return renderSummary(root(), go, ...args);
    case 'settings': return renderSettings(root(), go, ...args);
    default: throw new Error(`Unknown screen: ${screen}`);
  }
}
