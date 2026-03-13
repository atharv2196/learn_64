/**
 * OpeningCard – beautiful card for each opening/gambit with a mini board preview.
 * Uses react-chessboard to render a static mini board from the characteristic FEN.
 */
import { memo, useMemo } from 'react'
import { Chessboard } from 'react-chessboard'

const CATEGORY_STYLES = {
  Opening: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-400',
  },
  Gambit: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
  Defense: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
  System: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
    dot: 'bg-purple-400',
  },
}

const DEFAULT_STYLE = {
  bg: 'bg-gray-500/10',
  text: 'text-gray-400',
  border: 'border-gray-500/20',
  dot: 'bg-gray-400',
}

function OpeningCard({ repertoire, onClick }) {
  const catStyle = CATEGORY_STYLES[repertoire.category] || DEFAULT_STYLE

  // Get a characteristic FEN for the board thumbnail
  // Use the position after ~4-5 moves (the defining position of the opening)
  const previewFen = useMemo(() => {
    const lines = repertoire.lines || []
    if (lines.length === 0) return 'start'
    const moves = lines[0].moves || []
    // Target position: around move 4-6 for visual interest
    const targetIdx = Math.min(moves.length - 1, 5)
    if (targetIdx >= 0 && moves[targetIdx]?.fen) {
      return moves[targetIdx].fen
    }
    return 'start'
  }, [repertoire])

  return (
    <div
      onClick={onClick}
      className="group card-hover p-0 overflow-hidden cursor-pointer"
    >
      {/* Mini board preview */}
      <div className="relative overflow-hidden bg-gray-900/50">
        <div className="flex items-center justify-center py-3 px-4">
          <div className="rounded-lg overflow-hidden shadow-md ring-1 ring-gray-700/50 group-hover:ring-emerald-500/30 transition-all duration-300">
            <Chessboard
              id={`mini-${repertoire.id}`}
              position={previewFen}
              boardWidth={160}
              arePiecesDraggable={false}
              animationDuration={0}
              customBoardStyle={{ borderRadius: '6px' }}
              customDarkSquareStyle={{ backgroundColor: '#374151' }}
              customLightSquareStyle={{ backgroundColor: '#6b7280' }}
            />
          </div>
        </div>
        {/* Gradient overlay fade */}
        <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-gray-800/50 to-transparent" />
      </div>

      {/* Card content */}
      <div className="p-4 pt-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors duration-200 text-sm leading-tight">
            {repertoire.opening}
          </h3>
          <span
            className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${catStyle.bg} ${catStyle.text} border ${catStyle.border}`}
          >
            {repertoire.category}
          </span>
        </div>

        <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
          {repertoire.description}
        </p>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${repertoire.side === 'white' ? 'bg-white border border-gray-600' : 'bg-gray-900 border border-gray-500'}`} />
            <span className="text-gray-500">
              {repertoire.side === 'white' ? 'White' : 'Black'}
            </span>
          </div>
          <span className="text-gray-600">
            {repertoire.lines?.length || 0} line{(repertoire.lines?.length || 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

export default memo(OpeningCard)
