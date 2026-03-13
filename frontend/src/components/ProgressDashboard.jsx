/**
 * ProgressDashboard – displays accuracy per opening, streak, weak lines,
 * lines completed, and review-due count.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchProgress } from '../api/trainerApi'

export default function ProgressDashboard() {
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchProgress()
      .then((res) => setProgress(res.data))
      .catch((err) => console.error('Failed to load dashboard data', err))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="spinner" />
      </div>
    )
  }

  if (!progress) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 mb-4">No training data yet.</p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary"
        >
          Start Training
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* ── Summary Cards ────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Day Streak" value={progress.daily_streak} icon="🔥" />
        <SummaryCard label="Lines Completed" value={progress.total_lines_completed} icon="✅" />
        <SummaryCard label="Reviews Due" value={progress.review_due_count} icon="📖" />
        <SummaryCard
          label="Openings Studied"
          value={progress.accuracies?.length ?? 0}
          icon="♟️"
        />
      </div>

      {/* ── Accuracy per opening ──────────── */}
      <div>
        <h3 className="text-lg font-bold mb-3 text-white">Opening Accuracy</h3>
        {(!progress.accuracies || progress.accuracies.length === 0) ? (
          <p className="text-gray-500 text-sm">No attempts recorded yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {progress.accuracies.map((a) => (
              <div
                key={a.repertoire_id}
                className="card p-4 hover:border-emerald-500/30 transition-all"
              >
                <p className="font-semibold truncate text-white">{a.opening_name}</p>
                <p className="text-xs text-gray-500 mb-2">{a.category}</p>
                <div className="w-full bg-gray-700 rounded-full h-3 mb-1">
                  <div
                    className={`h-3 rounded-full ${
                      a.accuracy >= 0.8
                        ? 'bg-green-500'
                        : a.accuracy >= 0.5
                        ? 'bg-yellow-400'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round(a.accuracy * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {Math.round(a.accuracy * 100)}% ({a.correct}/{a.total_attempts})
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Weakest Lines ────────────────── */}
      {progress.weakest_openings && progress.weakest_openings.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-2 text-white">Lines to Review</h3>
          <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
            {progress.weakest_openings.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* Small helper for the summary cards */
function SummaryCard({ label, value, icon }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}
