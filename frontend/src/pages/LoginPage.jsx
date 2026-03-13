/**
 * LoginPage – Google Sign-In via Firebase.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { user, signInWithGoogle } = useAuth()
  const navigate = useNavigate()

  // If already signed in, redirect
  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    try {
      await signInWithGoogle()
      toast.success('Welcome!')
      navigate('/')
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        toast.error(err.message || 'Sign-in failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-5">
            <span className="text-4xl">♔</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Learn_64
          </h1>
          <p className="text-gray-400 text-base mt-3 max-w-xs mx-auto">
            Master chess openings with your team
          </p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-white mb-1">Get Started</h2>
            <p className="text-sm text-gray-500">Sign in to track your progress</p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white text-gray-800 font-semibold hover:bg-gray-100 disabled:opacity-50 transition-all duration-200 shadow-lg"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              <>
                {/* Google icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-600">
            No password needed. One click to get started.
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          Free & open-source chess training platform
        </p>
      </div>
    </div>
  )
}
