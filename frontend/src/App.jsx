/**
 * App – top-level router with role-based access control.
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import OpeningsPage from './pages/OpeningsPage'
import TrainingPage from './pages/TrainingPage'
import DashboardPage from './pages/DashboardPage'
import AdminPage from './pages/AdminPage'
import AssignmentsPage from './pages/AssignmentsPage'
import VerifyEmailPage from './pages/VerifyEmailPage'
import RoleSelectPage from './pages/RoleSelectPage'

function hasCompletedRoleCheck(profile) {
  if (!profile?.id) return false
  return sessionStorage.getItem(`learn64_role_checked_${profile.id}`) === '1'
}

function ProtectedRoute({ children }) {
  const { user, loading, profile } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!hasCompletedRoleCheck(profile)) return <Navigate to="/select-role" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function TeacherRoute({ children }) {
  const { user, loading, isAdmin, isTeacher } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin && !isTeacher) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, loading, profile } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="spinner" />
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/verify-email"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/select-role"
          element={
            user ? (
              hasCompletedRoleCheck(profile) ? <Navigate to="/" replace /> : <RoleSelectPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <OpeningsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/train"
          element={
            <ProtectedRoute>
              <TrainingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assignments"
          element={
            <ProtectedRoute>
              <AssignmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
