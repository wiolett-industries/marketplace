import React from 'react';
import { createRoot } from 'react-dom/client';

// Bundled fonts — the tool runs offline/loopback, so no CDN reliance.
import '@fontsource/saira-condensed/500.css';
import '@fontsource/saira-condensed/600.css';
import '@fontsource/saira-condensed/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';

import './theme.css';
import { App } from './App';

// Keep page zoom off so only the graph canvas zooms. Pinch-zoom arrives as a
// ctrl+wheel event; the graph's own (plain) wheel zoom is untouched. Also block
// keyboard zoom (Cmd/Ctrl +/-/0).
window.addEventListener(
  'wheel',
  (event) => {
    if (event.ctrlKey) event.preventDefault();
  },
  { passive: false },
);
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && ['=', '-', '+', '0'].includes(event.key)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
