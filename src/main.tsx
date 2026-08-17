import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted Hebrew font. The family this registers is `Heebo Variable`
// (not `Heebo`) — see src/styles/globals.css.
import '@fontsource-variable/heebo';

import './styles/globals.css';
import App from './App.tsx';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
