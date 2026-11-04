import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { AdminError } from './lib/errors';
import { sb } from './lib/supabase';
import { ThemeProvider } from './lib/theme';
import { createAdminRouter } from './router';
import './admin.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => count < 2 && !(err instanceof AdminError && ['forbidden', 'validation', 'not_found', 'auth'].includes(err.kind)),
    },
  },
  queryCache: new QueryCache({
    // A query that fails because the session ended sends the person back to sign in.
    onError: (err) => {
      if (err instanceof AdminError && err.kind === 'auth') void sb.auth.signOut().then(() => window.location.assign('/admin/login?expired=1'));
    },
  }),
});

const router = createAdminRouter();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
