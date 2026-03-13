/**
 * Auth context – Firebase Google Sign-In with role tracking.
 * Roles: admin, teacher, student.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'
import api from '../api/trainerApi'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null) // { id, name, email, role, email_verified }
  const [loading, setLoading] = useState(true)

  // Fetch backend profile (role, etc.)
  const fetchProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      setProfile(data)
      return data
    } catch {
      setProfile(null)
      return null
    }
  }, [])

  // Listen to Firebase auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        await fetchProfile()
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [fetchProfile])

  /** Sign in with Google popup */
  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, googleProvider)
    // Fetch profile immediately after sign-in
    await fetchProfile()
    return result
  }, [fetchProfile])

  /** Sign out */
  const logout = useCallback(async () => {
    await signOut(auth)
    setUser(null)
    setProfile(null)
  }, [])

  /** Get the current Firebase ID token (for API calls) */
  const getToken = useCallback(async () => {
    if (!auth.currentUser) return null
    return auth.currentUser.getIdToken()
  }, [])

  const role = profile?.role || 'student'
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'
  const emailVerified = profile?.email_verified || false

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        role,
        isAdmin,
        isTeacher,
        isStudent,
        emailVerified,
        signInWithGoogle,
        logout,
        getToken,
        fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
