import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { startBackgroundSync } from './offline/sync';
import { useAuth, homeFor } from './lib/auth';
import AppShell from './components/AppShell';
import Toaster from './components/Toast';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Account from './pages/Account';
import TeacherHome from './pages/teacher/Home';
import MarkAttendance from './pages/teacher/MarkAttendance';
import ClassHistory from './pages/teacher/ClassHistory';
import LeaveInbox from './pages/teacher/LeaveInbox';
import PickupBoard from './pages/teacher/PickupBoard';
import Child from './pages/parent/Child';
import Alerts from './pages/Alerts';
import AtRisk from './pages/AtRisk';
import Reports from './pages/Reports';
import InSchool from './pages/InSchool';
import { refreshPush } from './lib/push';
import ParentHome from './pages/parent/Home';
import Dashboard from './pages/admin/Dashboard';
import Classes from './pages/admin/Classes';
import Students from './pages/admin/Students';
import Teachers from './pages/admin/Teachers';
import Settings from './pages/admin/Settings';

function Guard({ role, children }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  const user = useAuth((s) => s.user);
  useEffect(() => {
    if (!user) return;
    if (user.role === 'teacher' || user.role === 'admin') startBackgroundSync();
    refreshPush();
  }, [user]);
  return (
    <>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />
        <Route path="/setup" element={<Setup />} />
        {/* Full-screen, no navigation bar: nothing to tap by mistake while marking. */}
        <Route path="/t/class/:id/mark" element={<Guard role="teacher"><MarkAttendance /></Guard>} />
        <Route path="/t/class/:id/pickup" element={<Guard role="teacher"><PickupBoard /></Guard>} />
        <Route path="/t/class/:id" element={<Navigate to="mark" replace />} />
        <Route element={<Guard><AppShell /></Guard>}>
          <Route path="/account" element={<Account />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/t/leave" element={<Guard role="teacher"><LeaveInbox /></Guard>} />
          <Route path="/p/child/:id" element={<Guard role="parent"><Child /></Guard>} />
          <Route path="/t" element={<Guard role="teacher"><TeacherHome /></Guard>} />
          <Route path="/t/class/:id/history" element={<Guard role="teacher"><ClassHistory /></Guard>} />
          <Route path="/p" element={<Guard role="parent"><ParentHome /></Guard>} />
          <Route path="/a" element={<Guard role="admin"><Dashboard /></Guard>} />
          <Route path="/a/classes" element={<Guard role="admin"><Classes /></Guard>} />
          <Route path="/a/at-risk" element={<Guard role="admin"><AtRisk /></Guard>} />
          <Route path="/a/reports" element={<Guard role="admin"><Reports /></Guard>} />
          <Route path="/a/in-school" element={<Guard role="admin"><InSchool /></Guard>} />
          <Route path="/t/at-risk" element={<Guard role="teacher"><AtRisk /></Guard>} />
          <Route path="/t/reports" element={<Guard role="teacher"><Reports /></Guard>} />
          <Route path="/a/students" element={<Guard role="admin"><Students /></Guard>} />
          <Route path="/a/teachers" element={<Guard role="admin"><Teachers /></Guard>} />
          <Route path="/a/settings" element={<Guard role="admin"><Settings /></Guard>} />
        </Route>
        <Route path="*" element={<Navigate to={user ? homeFor(user.role) : '/login'} replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
