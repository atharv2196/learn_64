/**
 * ChessBoard – interactive training board with auto-play and move highlighting.
 * Supports both drag-and-drop AND click-to-move (tap piece, tap destination).
 * Wraps react-chessboard for the guided training experience.
 */
import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'

function ChessBoardComponent({
  fen,
  side = 'white',
  onMove,
  disabled = false,
  boardWidth = 480,
  lastMove = '',
}) {
  const [boardPosition, setBoardPosition] = useState(fen || 'start')
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [legalMoves, setLegalMoves] = useState([])

  useEffect(() => {
    if (fen) setBoardPosition(fen)
  }, [fen])

  // Clear selection when fen changes or board gets disabled
  useEffect(() => {
    setSelectedSquare(null)
    setLegalMoves([])
  }, [fen, disabled])

  // Get legal moves from a given square using chess.js
  const getLegalMovesFrom = useCallback(
    (square) => {
      try {
        const chess = new Chess(boardPosition === 'start'
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : boardPosition)
        const moves = chess.moves({ square, verbose: true })
        return moves
      } catch {
        return []
      }
    },
    [boardPosition],
  )

  // Build UCI and submit move
  const submitClickMove = useCallback(
    (fromSquare, toSquare) => {
      const uci = fromSquare + toSquare
      // Check promotion
      try {
        const chess = new Chess(boardPosition === 'start'
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : boardPosition)
        const piece = chess.get(fromSquare)
        const isPromotion =
          piece?.type === 'p' &&
          ((toSquare[1] === '8' && piece.color === 'w') ||
           (toSquare[1] === '1' && piece.color === 'b'))
        const fullUci = isPromotion ? uci + 'q' : uci
        if (onMove) onMove(fullUci)
      } catch {
        if (onMove) onMove(uci)
      }
    },
    [boardPosition, onMove],
  )

  // Handle square click for click-to-move
  const handleSquareClick = useCallback(
    (square) => {
      if (disabled) return

      // If a piece is already selected…
      if (selectedSquare) {
        // Clicked the same square → deselect
        if (square === selectedSquare) {
          setSelectedSquare(null)
          setLegalMoves([])
          return
        }

        // Check if clicked square is a legal target
        const isLegalTarget = legalMoves.some((m) => m.to === square)
        if (isLegalTarget) {
          submitClickMove(selectedSquare, square)
          setSelectedSquare(null)
          setLegalMoves([])
          return
        }

        // Clicked another own piece → re-select that piece instead
        try {
          const chess = new Chess(boardPosition === 'start'
            ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
            : boardPosition)
          const piece = chess.get(square)
          if (piece && piece.color === chess.turn()) {
            const moves = getLegalMovesFrom(square)
            setSelectedSquare(square)
            setLegalMoves(moves)
            return
          }
        } catch { /* ignore */ }

        // Clicked an empty/enemy square that isn't a legal target → deselect
        setSelectedSquare(null)
        setLegalMoves([])
        return
      }

      // No piece selected yet — select if there's a piece of the current turn
      try {
        const chess = new Chess(boardPosition === 'start'
          ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
          : boardPosition)
        const piece = chess.get(square)
        if (piece && piece.color === chess.turn()) {
          const moves = getLegalMovesFrom(square)
          setSelectedSquare(square)
          setLegalMoves(moves)
        }
      } catch { /* ignore */ }
    },
    [disabled, selectedSquare, legalMoves, boardPosition, getLegalMovesFrom, submitClickMove],
  )

  // Highlight: last move + selected square + legal move indicators
  const customSquareStyles = useMemo(() => {
    const styles = {}

    // Last move highlight
    if (lastMove && lastMove.length >= 4) {
      const from = lastMove.substring(0, 2)
      const to = lastMove.substring(2, 4)
      styles[from] = { backgroundColor: 'rgba(255, 255, 0, 0.3)' }
      styles[to] = { backgroundColor: 'rgba(255, 255, 0, 0.4)' }
    }

    // Selected square highlight
    if (selectedSquare) {
      styles[selectedSquare] = {
        backgroundColor: 'rgba(16, 185, 129, 0.55)',
        borderRadius: '4px',
      }
    }

    // Legal move dots / capture rings
    for (const move of legalMoves) {
      if (move.captured) {
        // Capture target: ring indicator
        styles[move.to] = {
          ...styles[move.to],
          background:
            'radial-gradient(transparent 55%, rgba(16,185,129,0.45) 55%)',
          borderRadius: '50%',
        }
      } else {
        // Empty square: dot indicator
        styles[move.to] = {
          ...styles[move.to],
          background:
            'radial-gradient(circle, rgba(16,185,129,0.45) 25%, transparent 25%)',
          borderRadius: '50%',
        }
      }
    }

    return styles
  }, [lastMove, selectedSquare, legalMoves])

  const handleDrop = useCallback(
    (sourceSquare, targetSquare, piece) => {
      if (disabled) return false

      // Clear click-to-move selection
      setSelectedSquare(null)
      setLegalMoves([])

      // Build UCI notation
      const uci = sourceSquare + targetSquare
      // Check promotion
      const isPromotion =
        piece?.[1]?.toLowerCase() === 'p' &&
        ((targetSquare[1] === '8' && side === 'white') ||
         (targetSquare[1] === '1' && side === 'black'))
      const fullUci = isPromotion ? uci + 'q' : uci

      if (onMove) onMove(fullUci)
      return false // Let parent control position via fen prop
    },
    [disabled, onMove, side],
  )

  return (
    <div className="inline-block rounded-xl shadow-2xl overflow-hidden ring-1 ring-gray-700/50 max-w-full">
      <Chessboard
        id="training-board"
        position={boardPosition}
        onPieceDrop={handleDrop}
        onSquareClick={handleSquareClick}
        boardWidth={boardWidth}
        boardOrientation={side}
        animationDuration={250}
        arePiecesDraggable={!disabled}
        customSquareStyles={customSquareStyles}
        customBoardStyle={{
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        customDarkSquareStyle={{ backgroundColor: '#4a7c59' }}
        customLightSquareStyle={{ backgroundColor: '#e8eddf' }}
      />
    </div>
  )
}

export default memo(ChessBoardComponent)
