/**
 * RoleSelectPage - asks user which role they are before entering app.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const OPTIONS = [
  {
    key: 'student',
    title: 'Student',
    desc: 'I want to train assigned lines and improve openings.',
  },
  {
    key: 'teacher',
    title: 'Teacher',
    desc: 'I want to assign lines and monitor students.',
  },
  {
    key: 'admin',
    title: 'Admin',
    desc: 'I manage academy users and settings.',
  },
]

export default function RoleSelectPage() {
  const { role, profile } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState('student')

  const markSeen = () => {
    if (profile?.id) {
      sessionStorage.setItem(`learn64_role_checked_${profile.id}`, '1')
    }
  }

  const handleContinue = () => {
    if (selected === 'admin' && role !== 'admin') {
      toast('Admin role is managed by owner access. Your current role remains unchanged.')
    } else if (selected === 'teacher' && role !== 'teacher' && role !== 'admin') {
      toast('Teacher role must be granted by an admin. Your current role remains unchanged.')
    }

    markSeen()
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl card p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Choose Your Role</h1>
        <p className="text-sm text-gray-400 mb-6">
          Tell us who you are. Your real permissions are controlled by admin settings.
        </p>

        <div className="grid gap-3">
          {OPTIONS.map((opt) => {
            const active = selected === opt.key
            return (
              <button
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  active
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-gray-700 bg-gray-800/40 hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-base font-semibold text-white">{opt.title}</span>
                  {active && <span className="text-emerald-400 text-sm">Selected</span>}
                </div>
                <p className="text-sm text-gray-400 mt-1">{opt.desc}</p>
              </button>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500">
            Current account role: <span className="capitalize text-gray-300">{role}</span>
          </span>
          <button onClick={handleContinue} className="btn-primary px-6">
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
