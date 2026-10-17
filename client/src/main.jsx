import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ensureLanguage, initialLanguage } from './i18n';
import './lib/theme';
import './index.css';
import App from './App';

const queryClient = new QueryClient({
  defaultOptions: {
    // networkMode 'always': never pause a request because the phone looks offline. Our loaders
    // fall back to data saved on the phone (src/offline), so a teacher who loses signal after
    // opening the app can still open a class and mark it. With the default ('online'),
    // TanStack Query paused those requests and the marking screen stayed blank.
    // A request that never reached the server (API still starting, signal dropped) keeps retrying
    // for about 30 s; a real answer from the server (401, 404, 500) is retried once.
    queries: {
      staleTime: 30_000,
      retry: (count, err) => (err?.response ? count < 1 : count < 6),
      retryDelay: (n) => Math.min(1000 * 2 ** n, 8000),
      refetchOnWindowFocus: false,
      networkMode: 'always',
    },
    mutations: { networkMode: 'always' },
  },
});

// Load the one language needed before the first paint, so there is no flash of keys.
await ensureLanguage(initialLanguage);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
