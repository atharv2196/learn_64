/**
 * Navbar – persistent top navigation bar with role-based links.
 * Responsive: collapses into a hamburger menu on mobile.
 */
import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, role, isAdmin, isTeacher, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    navigate('/login')
  }

  if (!user) return null

  const linkClass = (path) =>
    `block px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
      location.pathname === path
        ? 'bg-emerald-500/15 text-emerald-400'
        : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`

  const roleBadge = {
    admin: 'bg-red-500/15 text-red-400 border-red-500/30',
    teacher: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    student: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  }

  const navLinks = [
    { to: '/', label: 'Openings' },
    { to: '/train', label: 'Train' },
    { to: '/dashboard', label: 'Progress' },
    { to: '/assignments', label: 'Assignments' },
    ...(isAdmin ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  return (
    <nav className="bg-gray-900/80 backdrop-blur-xl border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-2.5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <span className="text-xl">♔</span>
          <span className="text-lg font-bold text-white tracking-tight">
            Learn<span className="text-emerald-400">_64</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} className={linkClass(l.to)}>
              {l.label}
            </Link>
          ))}

          <div className="ml-3 pl-3 border-l border-gray-700 flex items-center gap-3">
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${roleBadge[role] || roleBadge.student}`}
            >
              {role}
            </span>
            <span className="text-xs text-gray-500 hidden lg:inline truncate max-w-[140px]">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-500 hover:text-red-400 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 transition-all duration-200"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Mobile: role badge + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider border ${roleBadge[role] || roleBadge.student}`}
          >
            {role}
          </span>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-800 bg-gray-900/95 backdrop-blur-xl px-4 pb-4 pt-2 space-y-1">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} className={linkClass(l.to)} onClick={() => setMenuOpen(false)}>
              {l.label}
            </Link>
          ))}
          <div className="pt-3 mt-2 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-gray-500 truncate max-w-[200px]">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-400 hover:text-red-300 px-3 py-2 rounded-lg hover:bg-red-500/10 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
