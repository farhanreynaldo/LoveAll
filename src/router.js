import { renderSetup } from './ui/setup.js';
import { renderLive } from './ui/live.js';
import { renderSummary } from './ui/summary.js';

const root = () => document.getElementById('app');

export function go(screen, ...args) {
  root().innerHTML = '';
  switch (screen) {
    case 'setup':   return renderSetup(root(), go);
    case 'live':    return renderLive(root(), go, ...args);
    case 'summary': return renderSummary(root(), go, ...args);
    default: throw new Error(`Unknown screen: ${screen}`);
  }
}
