import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { LoginForm } from './components/auth/LoginForm';
import { RegisterForm } from './components/auth/RegisterForm';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { UserManagement } from './components/admin/UserManagement';
import { SharedNotePage } from './components/notes/SharedNotePage';
import { Settings } from './components/settings/Settings';
import { DeletedNotes } from './components/trash/DeletedNotes';
import { Profile } from './components/profile/Profile';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/register" element={<RegisterForm />} />
            <Route path="/shared/:token" element={<SharedNotePage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<AppLayout />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/deleted" element={<DeletedNotes />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/users" element={<UserManagement />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
