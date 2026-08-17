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
import { NotFoundPage } from '@/pages/not-found/NotFoundPage';
import { PlaceholderPage } from '@/pages/placeholder/PlaceholderPage';
import { ErrorState } from '@/components/common/ErrorState';
import { nav } from '@/lib/copy';

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

              // Admin only. Placeholders until phases 4-5.
              {
                element: <RequireAdmin />,
                children: [
                  { path: '/dashboard', element: <PlaceholderPage title={nav.dashboard} /> },
                  { path: '/users', element: <PlaceholderPage title={nav.users} /> },
                  { path: '/users/new', element: <PlaceholderPage title={nav.newUser} /> },
                  { path: '/users/:id/edit', element: <PlaceholderPage title={nav.editUser} /> },
                  { path: '/stations/new', element: <PlaceholderPage title={nav.addStation} /> },
                  {
                    path: '/stations/:id/edit',
                    element: <PlaceholderPage title={nav.editStation} />,
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
