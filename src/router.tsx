import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Outlet } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthProvider';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RequireAdmin } from '@/components/auth/RequireAdmin';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/toaster';
import { SignInPage } from '@/pages/signin/SignInPage';
import { ForgotPasswordPage } from '@/pages/forgot-password/ForgotPasswordPage';
import { BlockedPage } from '@/pages/blocked/BlockedPage';
import { HomePage } from '@/pages/home/HomePage';
import { AreaPage } from '@/pages/area/AreaPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { ErrorState } from '@/components/common/ErrorState';
import { PageLoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { UpdatePrompt } from '@/components/common/UpdatePrompt';

/**
 * The admin screens load on demand.
 *
 * The field worker — the person this whole app is written around, and the one
 * on the worst connection — never opens any of them. Recharts alone is 9.6 MB
 * unpacked and is imported by the dashboard only, so making them lazy takes it
 * out of the bundle a worker downloads at the roadside.
 *
 * The pages are default-exported wrappers over the named exports: `lazy` needs
 * a module with a `default`, and adding a default export to each page would
 * mean two ways to import every screen.
 */
const DashboardPage = lazy(async () => ({
  default: (await import('@/pages/dashboard/DashboardPage')).DashboardPage,
}));
const UsersPage = lazy(async () => ({
  default: (await import('@/pages/users/UsersPage')).UsersPage,
}));
const UserCreatePage = lazy(async () => ({
  default: (await import('@/pages/users/UserCreatePage')).UserCreatePage,
}));
const UserEditPage = lazy(async () => ({
  default: (await import('@/pages/users/UserEditPage')).UserEditPage,
}));
const StationFormPage = lazy(async () => ({
  default: (await import('@/pages/stations/StationFormPage')).StationFormPage,
}));

/** A skeleton while the chunk arrives, never a blank frame or a spinner (§6). */
function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<PageLoadingSkeleton />}>{children}</Suspense>;
}

/**
 * A pathless root route owns the AuthProvider, so the provider sits inside the
 * router tree — every descendant can use `useNavigate`, and the root can carry
 * an errorElement.
 */
function RootLayout() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster />
      <UpdatePrompt />
    </AuthProvider>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <ErrorState />,
    children: [
      // Public.
      { path: '/signin', element: <SignInPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },

      // Public ON PURPOSE. /blocked signs out on mount; behind RequireAuth the
      // guard would see the vanished session and redirect to /signin before the
      // message could be read. See BlockedPage for the full reasoning.
      { path: '/blocked', element: <BlockedPage /> },

      // Signed in and authorized.
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShell />,
            children: [
              { path: '/', element: <HomePage /> },
              // RLS decides which areas are actually readable; a worker who
              // guesses another area's id gets an empty result, not a leak.
              { path: '/areas/:areaId', element: <AreaPage /> },

              // Admin only.
              {
                element: <RequireAdmin />,
                children: [
                  {
                    path: '/dashboard',
                    element: (
                      <Lazy>
                        <DashboardPage />
                      </Lazy>
                    ),
                  },
                  {
                    path: '/users',
                    element: (
                      <Lazy>
                        <UsersPage />
                      </Lazy>
                    ),
                  },
                  {
                    path: '/users/new',
                    element: (
                      <Lazy>
                        <UserCreatePage />
                      </Lazy>
                    ),
                  },
                  {
                    path: '/users/:id/edit',
                    element: (
                      <Lazy>
                        <UserEditPage />
                      </Lazy>
                    ),
                  },
                  {
                    path: '/stations/new',
                    element: (
                      <Lazy>
                        <StationFormPage mode="create" />
                      </Lazy>
                    ),
                  },
                  {
                    path: '/stations/:id/edit',
                    element: (
                      <Lazy>
                        <StationFormPage mode="edit" />
                      </Lazy>
                    ),
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
