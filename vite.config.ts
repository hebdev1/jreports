/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Serves admin/index.html for every /admin/* page URL (the public site keeps index.html). */
function adminFallback(): Plugin {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    const path = (req.url ?? '').split('?')[0];
    if (/^\/admin(\/|$)/.test(path) && !/\.[a-z0-9]+$/i.test(path)) req.url = '/admin/index.html';
    next();
  };
  return {
    name: 'admin-spa-fallback',
    configureServer: (server) => void server.middlewares.use(rewrite),
    configurePreviewServer: (server) => void server.middlewares.use(rewrite),
  };
}

export default defineConfig({
  // Tailwind only processes files that import it (src/admin/admin.css), so the public site's CSS is untouched.
  plugins: [react(), tailwindcss(), adminFallback()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        admin: fileURLToPath(new URL('./admin/index.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // jsdom start-up and first-time page imports are slow on some machines.
    testTimeout: 20_000,
  },
});
