import { createBrowserRouter, Outlet, type RouteObject } from 'react-router';
import { CollectionEditor, CollectionList } from './collections/framework';
import { archiveDef, episodesDef, reportsDef, sponsorsDef } from './collections/defs';
import { ConfirmProvider } from './components/common';
import { AdminShell, RequirePermission } from './components/shell';
import { AuthProvider } from './lib/auth';
import { AccountPage } from './routes/account';
import { AuditPage } from './routes/audit';
import { ForgotPasswordPage, LoginPage, ResetPasswordPage } from './routes/auth';
import { InboxPage } from './routes/inbox';
import { MediaPage } from './routes/media';
import { NotFoundPage } from './routes/not-found';
import { OverviewPage } from './routes/overview';
import { AboutSettingsPage, BrandSettingsPage, HeaderSettingsPage, HomeSettingsPage, WatchSettingsPage } from './routes/site';
import { TeamPage } from './routes/team';

function Root() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Outlet />
      </ConfirmProvider>
    </AuthProvider>
  );
}

const collection = (def: Parameters<typeof CollectionList>[0]['def'], crumb: string): RouteObject => ({
  path: def.basePath.replace('/admin/', ''),
  handle: { crumb },
  children: [
    { index: true, element: <CollectionList def={def} /> },
    { path: ':id', element: <CollectionEditor def={def} /> },
  ],
});

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <Root />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      {
        element: <AdminShell />,
        handle: { crumb: 'Admin' },
        children: [
          { index: true, element: <OverviewPage /> },
          collection(episodesDef as never, 'Episodes'),
          collection(reportsDef as never, 'Reports'),
          collection(archiveDef as never, 'Archive'),
          collection(sponsorsDef as never, 'Sponsors'),
          { path: 'media', handle: { crumb: 'Media library' }, element: <MediaPage /> },
          {
            path: 'inbox',
            handle: { crumb: 'Inbox' },
            children: [{ path: ':kind', element: <InboxPage /> }],
          },
          {
            path: 'site',
            handle: { crumb: 'Site' },
            children: [
              { path: 'home', handle: { crumb: 'Homepage' }, element: <HomeSettingsPage /> },
              { path: 'header', handle: { crumb: 'Header & footer' }, element: <HeaderSettingsPage /> },
              { path: 'watch', handle: { crumb: 'Watch & podcast' }, element: <WatchSettingsPage /> },
              { path: 'about', handle: { crumb: 'About page' }, element: <AboutSettingsPage /> },
              { path: 'brand', handle: { crumb: 'Brand & SEO' }, element: <BrandSettingsPage /> },
            ],
          },
          { path: 'team', handle: { crumb: 'Team' }, element: <TeamPage /> },
          {
            path: 'audit',
            handle: { crumb: 'Audit log' },
            element: (
              <RequirePermission permission="view_audit">
                <AuditPage />
              </RequirePermission>
            ),
          },
          { path: 'account', handle: { crumb: 'Account' }, element: <AccountPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage outside /> },
];

export const createAdminRouter = () => createBrowserRouter(adminRoutes);
