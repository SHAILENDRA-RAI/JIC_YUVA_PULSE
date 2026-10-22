import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminRoute, ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { SignIn } from '@/pages/auth/SignIn';
import { Setup } from '@/pages/auth/Setup';
import { Overview } from '@/pages/Overview';
import { YUVADirectory } from '@/pages/YUVADirectory';
import { Availability } from '@/pages/Availability';
import { Tasks } from '@/pages/Tasks';
import { Social } from '@/pages/Social';
import { ModulePlaceholder } from '@/pages/ModulePlaceholder';

function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Overview />} />
              <Route path="directory" element={<YUVADirectory />} />
              <Route path="availability" element={<Availability />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="social" element={<Social />} />
              <Route path="events" element={<ModulePlaceholder />} />
              <Route path="analytics" element={<ModulePlaceholder />} />
              <Route path="notifications" element={<ModulePlaceholder />} />
              <Route path="admin" element={<AdminRoute><ModulePlaceholder /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}

export default App;
