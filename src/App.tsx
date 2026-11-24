import { useEffect } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';

import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminRoute, ProtectedRoute } from '@/components/layout/ProtectedRoute';

import { SignIn } from '@/pages/auth/SignIn';
import { SignUp } from '@/pages/auth/SignUp';
import { Setup } from '@/pages/auth/Setup';
import { PendingApproval } from '@/pages/auth/PendingApproval';
import { ForgotPassword } from '@/pages/auth/ForgotPassword';
import { ResetPassword } from '@/pages/auth/ResetPassword';

import { Overview } from '@/pages/Overview';
import { YUVADirectory } from '@/pages/YUVADirectory';
import { Availability } from '@/pages/Availability';
import { Tasks } from '@/pages/Tasks';
import { Social } from '@/pages/Social';
import { Events } from '@/pages/Events';
import { Analytics } from '@/pages/Analytics';
import { Chat } from '@/pages/Chat';
import { Notifications } from '@/pages/Notifications';

import { Admin } from '@/Admin';
import { DepartmentAssignments } from '@/pages/DepartmentAssignments';

// Detect password recovery redirects
function PasswordRecoveryRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const url = new URL(window.location.href);

    if (url.searchParams.get('auth') === 'reset') {
      // Preserve Supabase query parameters, including its PKCE code.
      navigate('/reset-password', { replace: true });

      // Remove our routing marker to avoid redirecting again on refresh.
      url.searchParams.delete('auth');

      window.history.replaceState(
        window.history.state,
        '',
        url.toString()
      );
    }
  }, [navigate]);

  return null;
}

function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>

          <PasswordRecoveryRedirect />

          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/setup" element={<Setup />} />

            <Route
              path="/forgot-password"
              element={<ForgotPassword />}
            />

            <Route
              path="/reset-password"
              element={<ResetPassword />}
            />

            <Route
              path="/pending-approval"
              element={<PendingApproval />}
            />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Overview />} />

              <Route path="directory" element={<YUVADirectory />} />
              <Route path="availability" element={<Availability />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="social" element={<Social />} />
              <Route path="events" element={<Events />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="chat" element={<Chat />} />
              <Route path="notifications" element={<Notifications />} />

              <Route
                path="admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />

              <Route
                path="department-membership"
                element={
                  <AdminRoute>
                    <DepartmentAssignments />
                  </AdminRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}

export default App;
