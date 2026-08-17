import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Self-hosted Hebrew font. The family this registers is `Heebo Variable`
// (not `Heebo`) — see src/styles/globals.css.
import '@fontsource-variable/heebo';

import './styles/globals.css';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Field connectivity is poor; refetching on every window focus burns a
      // scarce resource for data that changes on a human timescale.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
