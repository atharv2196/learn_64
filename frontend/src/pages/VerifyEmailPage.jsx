/**
 * VerifyEmailPage - universal OTP verification for all signed-in users.
 */
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { requestOTP, verifyOTP } from '../api/trainerApi'

export default function VerifyEmailPage() {
  const { user, emailVerified, fetchProfile } = useAuth()
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [debugOtp, setDebugOtp] = useState('')
  const [loading, setLoading] = useState(false)

  if (!user) return <Navigate to="/login" replace />
  if (emailVerified) return <Navigate to="/" replace />

  const handleRequestOTP = async () => {
    setLoading(true)
    try {
      const { data } = await requestOTP()
      setOtpSent(true)
      if (data?.otp_code) {
        setDebugOtp(String(data.otp_code))
        setOtpCode(String(data.otp_code))
        toast.success(`OTP ready: ${data.otp_code}`)
      } else {
        setDebugOtp('')
        toast.success('OTP sent to your email')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast.error('Enter a 6-digit code')
      return
    }

    setLoading(true)
    try {
      await verifyOTP(otpCode)
      await fetchProfile()
      toast.success('Email verified successfully')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md card p-8 text-center space-y-5">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mx-auto">
          <span className="text-3xl">✉️</span>
        </div>

        <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
        <p className="text-sm text-gray-400">
          For account security, verify your email with a one-time password.
        </p>
        <p className="text-xs text-gray-500 break-all">
          Signed in as: {user.email}
        </p>

        {!otpSent ? (
          <button
            onClick={handleRequestOTP}
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? 'Sending...' : 'Send Verification Code'}
          </button>
        ) : (
          <div className="space-y-3">
            {debugOtp && (
              <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
                Debug OTP: <span className="font-mono font-semibold">{debugOtp}</span>
              </div>
            )}
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit code"
              className="input-field text-center text-2xl tracking-[0.45em] font-mono"
            />
            <button
              onClick={handleVerifyOTP}
              disabled={loading || otpCode.length !== 6}
              className="btn-primary w-full"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
            <button
              onClick={handleRequestOTP}
              disabled={loading}
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
