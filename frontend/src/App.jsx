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

function ProtectedRoute({ children }) {
  const { user, loading, emailVerified } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!emailVerified) return <Navigate to="/verify-email" replace />
  return children
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin, emailVerified } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!emailVerified) return <Navigate to="/verify-email" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function TeacherRoute({ children }) {
  const { user, loading, isAdmin, isTeacher, emailVerified } = useAuth()
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!emailVerified) return <Navigate to="/verify-email" replace />
  if (!isAdmin && !isTeacher) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, loading, emailVerified } = useAuth()

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
              emailVerified ? <Navigate to="/" replace /> : <VerifyEmailPage />
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
