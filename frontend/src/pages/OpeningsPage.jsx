/**
 * OpeningsPage – browse all curated openings/gambits and pick one to train.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import OpeningSelector from '../components/OpeningSelector'
import { fetchRepertoires } from '../api/trainerApi'

export default function OpeningsPage() {
  const [repertoires, setRepertoires] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchRepertoires()
      .then((res) => setRepertoires(res.data.repertoires || []))
      .catch(() => toast.error('Failed to load openings'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = (rep) => {
    navigate(`/train?id=${rep.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="spinner" />
        <span className="ml-3 text-gray-500">Loading openings...</span>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Opening Repertoire
        </h1>
        <p className="text-gray-400 mt-3 text-base sm:text-lg max-w-2xl">
          Choose an opening or gambit to practice. Each has multiple lines
          with step-by-step guided training and spaced repetition.
        </p>
        <div className="flex items-center gap-4 mt-5">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {repertoires.length} openings available
          </div>
        </div>
      </div>

      <OpeningSelector repertoires={repertoires} onSelect={handleSelect} />
    </div>
  )
}
