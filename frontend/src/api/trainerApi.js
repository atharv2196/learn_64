/**
 * Axios instance + API helpers for Learn_64.
 */
import axios from 'axios'
import { auth } from '../firebase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor – attach Firebase ID token ──────
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // If token refresh fails, proceed without auth
  }
  return config
})

// ── Response interceptor – handle 401 ───────────────────
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      try {
        await auth.signOut()
      } catch {
        // ignore sign-out errors
      }
    }
    return Promise.reject(err)
  },
)

// ── Repertoire endpoints ────────────────────────────────

/** Fetch all available repertoires */
export const fetchRepertoires = () => api.get('/repertoires')

/** Fetch a single repertoire's full data */
export const fetchRepertoire = (id) => api.get(`/repertoires/${id}`)

/** Fetch a specific line from a repertoire */
export const fetchLine = (id, lineIndex) =>
  api.get(`/repertoires/${id}/lines/${lineIndex}`)

// ── Training endpoints ──────────────────────────────────

/** Start a new training session */
export const startTraining = (repertoireId, lineIndex = 0, mode = 'learn') =>
  api.post('/training/start', {
    repertoire_id: repertoireId,
    line_index: lineIndex,
    mode,
  })

/** Submit a student move */
export const submitMove = (sessionId, userMove) =>
  api.post('/training/submit-move', {
    session_id: sessionId,
    user_move: userMove,
  })

/** Get session status */
export const getSession = (sessionId) =>
  api.get(`/training/session/${sessionId}`)

/** End a training session */
export const endSession = (sessionId) =>
  api.delete(`/training/session/${sessionId}`)

// ── Progress endpoints ──────────────────────────────────

/** Get student progress */
export const fetchProgress = () => api.get('/training/progress')

// ── Admin endpoints ─────────────────────────────────────

/** List all users (admin) */
export const fetchUsers = () => api.get('/admin/users')

/** List students (admin) */
export const fetchStudents = () => api.get('/admin/students')

/** List teachers (admin) */
export const fetchTeachers = () => api.get('/admin/teachers')

/** Add teacher by email (admin) */
export const addTeacher = (email) => api.post('/admin/add-teacher', { email })

/** Remove teacher (admin) */
export const removeTeacher = (userId) => api.delete(`/admin/remove-teacher/${userId}`)

// ── OTP endpoints ───────────────────────────────────────

/** Request OTP for email verification */
export const requestOTP = () => api.post('/auth/request-otp')

/** Verify OTP code */
export const verifyOTP = (otpCode) => api.post('/auth/verify-otp', { otp_code: otpCode })

/** Debug fallback: verify email directly when OTP_DEBUG_MODE is enabled */
export const debugVerifyEmail = () => api.post('/auth/debug-verify')

// ── Assignment endpoints ────────────────────────────────

/** Create assignment (teacher/admin → student) */
export const createAssignment = (studentId, repertoireId, lineIndex, note = '') =>
  api.post('/assignments', {
    student_id: studentId,
    repertoire_id: repertoireId,
    line_index: lineIndex,
    note,
  })

/** Get my assignments (student) */
export const fetchMyAssignments = () => api.get('/assignments/my')

/** Get assignments I gave (teacher) */
export const fetchGivenAssignments = () => api.get('/assignments/given')

/** List assignable students (teacher) */
export const fetchAssignableStudents = () => api.get('/assignments/students')

/** Mark assignment completed */
export const completeAssignment = (id) => api.patch(`/assignments/${id}/complete`)

/** Delete assignment */
export const deleteAssignment = (id) => api.delete(`/assignments/${id}`)

export default api
