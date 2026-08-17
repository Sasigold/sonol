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
import { StationFormPage } from '@/pages/stations/StationFormPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { UsersPage } from '@/pages/users/UsersPage';
import { UserCreatePage } from '@/pages/users/UserCreatePage';
import { UserEditPage } from '@/pages/users/UserEditPage';
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { ErrorState } from '@/components/common/ErrorState';

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
                  { path: '/dashboard', element: <DashboardPage /> },
                  { path: '/users', element: <UsersPage /> },
                  { path: '/users/new', element: <UserCreatePage /> },
                  { path: '/users/:id/edit', element: <UserEditPage /> },
                  { path: '/stations/new', element: <StationFormPage mode="create" /> },
                  { path: '/stations/:id/edit', element: <StationFormPage mode="edit" /> },
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
