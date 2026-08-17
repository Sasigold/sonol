import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DirectionProvider } from '@radix-ui/react-direction';

// Self-hosted Hebrew font. The family this registers is `Heebo Variable`
// (not `Heebo`) — see src/styles/globals.css.
import '@fontsource-variable/heebo';

import './styles/globals.css';
import { router } from './router';
import { disableZoomGestures } from './lib/no-zoom';

// Before first paint, not in an effect: an effect would leave a window in
// which a pinch still zooms, and StrictMode would attach it twice.
disableZoomGestures();

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

/**
 * Radix does NOT read `dir` off the document — it reads this context, and
 * defaults to `'ltr'` when it is absent. Every direction-aware primitive then
 * writes that fallback out as a real `dir` attribute, which beats the
 * `dir="rtl"` on `<html>` (and, for portalled content, is not even a
 * descendant of the element it would need to inherit from).
 *
 * Our own primitives each pin `dir="rtl"` at their root, so they are correct
 * even rendered in isolation — in a unit test, say, where there is no provider.
 * This is the safety net for the next Radix primitive someone adds: it makes
 * `rtl` the default the whole tree resolves to, rather than something each
 * component has to remember.
 */
createRoot(container).render(
  <StrictMode>
    <DirectionProvider dir="rtl">
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </DirectionProvider>
  </StrictMode>,
);
