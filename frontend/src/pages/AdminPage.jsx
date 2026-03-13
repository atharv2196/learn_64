/**
 * AdminPage – Admin dashboard for OTP verification and teacher management.
 */
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  requestOTP,
  verifyOTP,
  fetchUsers,
  fetchTeachers,
  addTeacher,
  removeTeacher,
} from '../api/trainerApi'

export default function AdminPage() {
  const { emailVerified, fetchProfile } = useAuth()

  /* ── OTP verification state ── */
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)

  /* ── Teacher management state ── */
  const [teachers, setTeachers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [newTeacherEmail, setNewTeacherEmail] = useState('')
  const [loadingTeachers, setLoadingTeachers] = useState(false)
  const [tab, setTab] = useState('teachers')

  useEffect(() => {
    if (emailVerified) {
      loadData()
    }
  }, [emailVerified])

  const loadData = async () => {
    setLoadingTeachers(true)
    try {
      const [teacherRes, userRes] = await Promise.all([
        fetchTeachers(),
        fetchUsers(),
      ])
      setTeachers(teacherRes.data.users || [])
      setAllUsers(userRes.data.users || [])
    } catch {
      toast.error('Failed to load data')
    } finally {
      setLoadingTeachers(false)
    }
  }

  /* ── OTP handlers ── */
  const handleRequestOTP = async () => {
    setOtpLoading(true)
    try {
      await requestOTP()
      setOtpSent(true)
      toast.success('OTP sent to your email')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setOtpLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast.error('Enter a 6-digit code')
      return
    }
    setOtpLoading(true)
    try {
      await verifyOTP(otpCode)
      toast.success('Email verified! Admin access unlocked.')
      await fetchProfile()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP')
    } finally {
      setOtpLoading(false)
    }
  }

  /* ── Teacher handlers ── */
  const handleAddTeacher = async () => {
    const email = newTeacherEmail.trim()
    if (!email) return
    try {
      const { data } = await addTeacher(email)
      toast.success(data.detail)
      setNewTeacherEmail('')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add teacher')
    }
  }

  const handleRemoveTeacher = async (userId) => {
    try {
      await removeTeacher(userId)
      toast.success('Teacher removed')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove teacher')
    }
  }

  /* ── Render: OTP verification (if not verified) ── */
  if (!emailVerified) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="card p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 mx-auto">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Verification</h1>
          <p className="text-gray-400 text-sm">
            Verify your email with a one-time code to unlock admin features.
          </p>

          {!otpSent ? (
            <button
              onClick={handleRequestOTP}
              disabled={otpLoading}
              className="btn-primary w-full"
            >
              {otpLoading ? 'Sending...' : 'Send Verification Code'}
            </button>
          ) : (
            <div className="space-y-4">
              <p className="text-emerald-400 text-sm">
                Code sent! Check your email.
              </p>
              <input
                type="text"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit code"
                className="input-field text-center text-2xl tracking-[0.5em] font-mono"
              />
              <button
                onClick={handleVerifyOTP}
                disabled={otpLoading || otpCode.length !== 6}
                className="btn-primary w-full"
              >
                {otpLoading ? 'Verifying...' : 'Verify'}
              </button>
              <button
                onClick={handleRequestOTP}
                disabled={otpLoading}
                className="text-sm text-gray-500 hover:text-gray-300 transition"
              >
                Resend code
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── Render: Admin dashboard ── */
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-6">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['teachers', 'all users'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
              tab === t
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Add Teacher */}
      {tab === 'teachers' && (
        <div className="card p-5 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Add Teacher</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={newTeacherEmail}
              onChange={(e) => setNewTeacherEmail(e.target.value)}
              placeholder="teacher@example.com"
              className="input-field flex-1"
            />
            <button onClick={handleAddTeacher} className="btn-primary whitespace-nowrap">
              Add
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            If the user hasn't signed up yet, they'll get the teacher role when they sign in.
          </p>
        </div>
      )}

      {/* Teacher list */}
      {tab === 'teachers' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Teachers ({teachers.length})
          </h2>
          {loadingTeachers ? (
            <div className="flex justify-center py-8"><span className="spinner" /></div>
          ) : teachers.length === 0 ? (
            <p className="text-gray-500 text-sm">No teachers yet.</p>
          ) : (
            teachers.map((t) => (
              <div key={t.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-white">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.email}</p>
                </div>
                <button
                  onClick={() => handleRemoveTeacher(t.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* All users list */}
      {tab === 'all users' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            All Users ({allUsers.length})
          </h2>
          {loadingTeachers ? (
            <div className="flex justify-center py-8"><span className="spinner" /></div>
          ) : (
            allUsers.map((u) => {
              const roleBadge = {
                admin: 'bg-red-500/15 text-red-400 border-red-500/30',
                teacher: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                student: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
              }
              return (
                <div key={u.id} className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-white">{u.name}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${roleBadge[u.role] || roleBadge.student}`}
                  >
                    {u.role}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
