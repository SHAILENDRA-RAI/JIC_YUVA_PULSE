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
import { Events } from '@/pages/Events';
import { Analytics } from '@/pages/Analytics';
import { Chat } from '@/pages/Chat';
import { Notifications } from '@/pages/Notifications';
import { Admin } from '@/Admin';
import { DepartmentAssignments } from '@/pages/DepartmentAssignments';
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
              <Route path="events" element={<Events />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="chat" element={<Chat />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
              <Route path="department-membership" element={<AdminRoute><DepartmentAssignments /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  );
}

export default App;
