import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';

type PageModule = { default: React.ComponentType } | Record<string, React.ComponentType>;

/** Loads a page on first visit; the home page ships in the main bundle. */
function page(load: () => Promise<PageModule>, name = 'default'): Pick<RouteObject, 'lazy'> {
  return { lazy: async () => ({ Component: (await load())[name as keyof PageModule] as React.ComponentType }) };
}

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    hydrateFallbackElement: <div style={{ minHeight: '100vh', background: '#F7F8FC' }} />,
    children: [
      { index: true, element: <Home /> },
      { path: 'watch', ...page(() => import('./pages/Watch')) },
      { path: 'podcast', ...page(() => import('./pages/Podcast')) },
      { path: 'episodes', ...page(() => import('./pages/Episodes')) },
      { path: 'episodes/:id', ...page(() => import('./pages/Episode')) },
      { path: 'reports', ...page(() => import('./pages/Simple'), 'Reports') },
      { path: 'archive', ...page(() => import('./pages/Simple'), 'Archive') },
      { path: 'about', ...page(() => import('./pages/About')) },
      { path: 'booking', ...page(() => import('./pages/Booking')) },
      { path: 'support', ...page(() => import('./pages/Support')) },
      { path: 'vip', ...page(() => import('./pages/Vip')) },
      { path: 'guest', ...page(() => import('./pages/Guest')) },
      { path: 'release', ...page(() => import('./pages/Release')) },
      { path: '*', element: <NotFound /> },
    ],
  },
];

export const router = createBrowserRouter(routes);
