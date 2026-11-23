import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import { Check, X as XIcon, Info } from 'lucide-react';
import { cx } from './lib/utils';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import Students from './pages/Students';
import StudentProfile from './pages/StudentProfile';
import Accounts from './pages/Accounts';
import Attendance from './pages/Attendance';
import Grades from './pages/Grades';
import Behavior from './pages/Behavior';
import Honor from './pages/Honor';
import Schedule from './pages/Schedule';
import Announcements from './pages/Announcements';
import Reports from './pages/Reports';
import Channel from './pages/Channel';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import About from './pages/About';
import Messages from './pages/Messages';
import AdminAssistant from './pages/AdminAssistant';

const TEACHING = ['admin', 'assistant', 'teacher'];
const STAFF = ['admin', 'assistant'];

function ToastStack() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg animate-fade-up',
            t.type === 'error' ? 'bg-red-600' : t.type === 'info' ? 'bg-brand-600' : 'bg-emerald-600',
          )}
        >
          {t.type === 'error' ? <XIcon className="h-4 w-4" /> : t.type === 'info' ? <Info className="h-4 w-4" /> : <Check className="h-4 w-4" />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

function AppRoutes() {
  const { session } = useApp();
  return (
    <>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/setup" element={<Setup />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/classes" element={<ProtectedRoute roles={TEACHING}><Classes /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute roles={TEACHING}><Students /></ProtectedRoute>} />
          <Route path="/students/:id" element={<ProtectedRoute roles={TEACHING}><StudentProfile /></ProtectedRoute>} />
          <Route path="/accounts" element={<ProtectedRoute roles={STAFF}><Accounts /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute roles={TEACHING}><Attendance /></ProtectedRoute>} />
          <Route path="/grades" element={<ProtectedRoute roles={TEACHING}><Grades /></ProtectedRoute>} />
          <Route path="/behavior" element={<ProtectedRoute roles={TEACHING}><Behavior /></ProtectedRoute>} />
          <Route path="/honor" element={<Honor />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/reports" element={<ProtectedRoute roles={TEACHING}><Reports /></ProtectedRoute>} />
          <Route path="/channel" element={<Channel />} />
          <Route path="/messages" element={<ProtectedRoute roles={['admin', 'assistant', 'student', 'guardian']}><Messages /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/about" element={<About />} />
        </Route>
        <Route path="/ai-assistant" element={<ProtectedRoute roles={['admin']}><AdminAssistant /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastStack />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
