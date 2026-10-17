import { useEffect, lazy, Suspense } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from './lib/auth';
import Toaster from './components/Toast';
import { Skeleton } from './components/ui';
import Login from './pages/Login';

// Every screen except Login loads on demand; after the first visit the service worker keeps them all on the phone.
const AppShell = lazy(() => import('./components/AppShell'));
const Setup = lazy(() => import('./pages/Setup'));
const Account = lazy(() => import('./pages/Account'));
const TeacherHome = lazy(() => import('./pages/teacher/Home'));
const MarkAttendance = lazy(() => import('./pages/teacher/MarkAttendance'));
const ClassHistory = lazy(() => import('./pages/teacher/ClassHistory'));
const LeaveInbox = lazy(() => import('./pages/teacher/LeaveInbox'));
const PickupBoard = lazy(() => import('./pages/teacher/PickupBoard'));
const Child = lazy(() => import('./pages/parent/Child'));
const Alerts = lazy(() => import('./pages/Alerts'));
const AtRisk = lazy(() => import('./pages/AtRisk'));
const Reports = lazy(() => import('./pages/Reports'));
const InSchool = lazy(() => import('./pages/InSchool'));
const ParentHome = lazy(() => import('./pages/parent/Home'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Classes = lazy(() => import('./pages/admin/Classes'));
const Students = lazy(() => import('./pages/admin/Students'));
const Teachers = lazy(() => import('./pages/admin/Teachers'));
const Settings = lazy(() => import('./pages/admin/Settings'));

function Guard({ role, children }) {
  const user = useAuth((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  const user = useAuth((s) => s.user);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!user) return;
    if (user.role === 'teacher' || user.role === 'admin') import('./offline/sync').then((m) => m.startBackgroundSync());
    import('./lib/push').then((m) => m.refreshPush());
  }, [user]);
  return (
    <>
      {/* Teachers on 3G download only what the morning register needs; other screens load when opened. */}
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<div className="mx-auto max-w-3xl p-6"><Skeleton className="h-40" /></div>}>
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
      </Suspense>
      </ErrorBoundary>
      <Toaster />
    </>
  );
}
