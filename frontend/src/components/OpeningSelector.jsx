/**
 * OpeningSelector – browse and select openings/gambits with visual cards.
 */
import { useState } from 'react'
import OpeningCard from './OpeningCard'

export default function OpeningSelector({ repertoires, onSelect }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const categories = ['all', ...new Set(repertoires.map((r) => r.category))]

  const filtered = repertoires.filter((r) => {
    const matchCategory = filter === 'all' || r.category === filter
    const matchSearch =
      !search ||
      r.opening.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  return (
    <div className="space-y-6">
      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Search openings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                filter === cat
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {filtered.length} opening{filtered.length !== 1 ? 's' : ''} found
      </p>

      {/* Grid of opening cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((rep) => (
          <OpeningCard
            key={rep.id}
            repertoire={rep}
            onClick={() => onSelect(rep)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <span className="text-4xl mb-3 block">🔍</span>
          <p className="text-gray-500">No openings match your search.</p>
        </div>
      )}
    </div>
  )
}
