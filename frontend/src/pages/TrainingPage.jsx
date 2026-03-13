/**
 * TrainingPage – interactive guided training with auto-play opponent moves,
 * move validation, inline feedback, and progress tracking.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import toast from 'react-hot-toast'
import ChessBoard from '../components/ChessBoard'
import MoveFeedback from '../components/MoveFeedbackModal'
import {
  fetchRepertoire,
  startTraining,
  submitMove,
  endSession,
} from '../api/trainerApi'

/* Phase constants */
const P = {
  SELECT: 'select',
  AUTO: 'auto',
  STUDENT: 'student',
  FEEDBACK: 'feedback',
  COMPLETE: 'complete',
}

const AUTO_MOVE_DELAY = 650
const MAX_BOARD = 480

/** Hook: returns a responsive board width based on a container ref */
function useBoardWidth(containerRef) {
  const [width, setWidth] = useState(MAX_BOARD)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      setWidth(Math.min(MAX_BOARD, w - 2)) // -2 for ring border
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])
  return width
}

export default function TrainingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const repertoireId = searchParams.get('id')
  const preselectedLine = searchParams.get('line')

  /* ── Repertoire & line selection ──────────────────────── */
  const [repertoire, setRepertoire] = useState(null)
  const [selectedLine, setSelectedLine] = useState(null)
  const [selectedMode, setSelectedMode] = useState('learn')
  const [loading, setLoading] = useState(true)

  /* ── Training session state ────────────────────────────── */
  const [sessionId, setSessionId] = useState(null)
  const [side, setSide] = useState('white')
  const [totalMoves, setTotalMoves] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [lineName, setLineName] = useState('')

  /* ── Board state ───────────────────────────────────────── */
  const [fen, setFen] = useState('start')
  const [lastMove, setLastMove] = useState('')
  const [phase, setPhase] = useState(P.SELECT)

  /* ── Feedback ──────────────────────────────────────────── */
  const [feedback, setFeedback] = useState(null)
  const [hint, setHint] = useState(null)
  const [wrongAttempts, setWrongAttempts] = useState(0)

  /* Refs for animation timers & scroll */
  const timerRef = useRef(null)
  const sessionIdRef = useRef(null)
  const boardRef = useRef(null)
  const boardContainerRef = useRef(null)
  const boardWidth = useBoardWidth(boardContainerRef)

  // Keep ref in sync with state so cleanup works
  useEffect(() => {
    sessionIdRef.current = sessionId
  }, [sessionId])

  /* ── Fetch repertoire ──────────────────────────────────── */
  useEffect(() => {
    if (!repertoireId) {
      navigate('/')
      return
    }
    fetchRepertoire(repertoireId)
      .then((res) => {
        setRepertoire(res.data)
        // If a line was preselected via URL param, auto-select it
        if (preselectedLine !== null && preselectedLine !== undefined) {
          const idx = parseInt(preselectedLine, 10)
          if (!isNaN(idx)) setSelectedLine(idx)
        }
      })
      .catch(() => {
        toast.error('Opening not found')
        navigate('/')
      })
      .finally(() => setLoading(false))
  }, [repertoireId, navigate, preselectedLine])

  /* ── Cleanup on unmount ────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (sessionIdRef.current) endSession(sessionIdRef.current).catch(() => {})
    }
  }, [])

  /* ── Auto-move animation ───────────────────────────────── */
  const animateAutoMoves = useCallback((queue, finalFen) => {
    if (!queue || queue.length === 0) {
      if (finalFen) setFen(finalFen)
      setPhase(P.STUDENT)
      return
    }

    setPhase(P.AUTO)

    const playNext = (moves, idx) => {
      if (idx >= moves.length) {
        // After all auto-moves, ensure board is at the correct student position
        if (finalFen) setFen(finalFen)
        setPhase(P.STUDENT)
        return
      }

      const m = moves[idx]

      timerRef.current = setTimeout(() => {
        // Apply the move with chess.js to get resulting position
        try {
          const chess = new Chess(m.fen)
          const from = m.move.substring(0, 2)
          const to = m.move.substring(2, 4)
          const promo = m.move.length > 4 ? m.move[4] : undefined
          chess.move({ from, to, promotion: promo })
          setFen(chess.fen())
        } catch {
          // Fallback: just use the fen field (pre-move)
          setFen(m.fen)
        }
        setLastMove(m.move)
        setCurrentStep((prev) => prev + 1)

        // Next auto-move or transition to student
        if (idx + 1 < moves.length) {
          playNext(moves, idx + 1)
        } else {
          if (finalFen) setFen(finalFen)
          setPhase(P.STUDENT)
        }
      }, AUTO_MOVE_DELAY)
    }

    playNext(queue, 0)
  }, [])

  /* ── Start a training session ──────────────────────────── */
  const handleStartTraining = async () => {
    if (selectedLine === null) {
      toast.error('Please select a line')
      return
    }

    try {
      const { data } = await startTraining(repertoireId, selectedLine, selectedMode)
      setSessionId(data.session_id)
      setSide(data.side)
      setTotalMoves(data.total_moves)
      setCurrentStep(0)
      setLineName(data.line_name)
      setFeedback(null)
      setHint(data.hint || null)
      setWrongAttempts(0)

      const first = data.move

      if (first.type === 'auto') {
        // Show start position, then animate
        setFen(first.fen)
        animateAutoMoves([first], null)
      } else {
        // Student's turn immediately
        setFen(first.fen)
        setPhase(P.STUDENT)
      }

      // Scroll board into view after a short delay for render
      setTimeout(() => {
        boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start training')
    }
  }

  /* ── Handle student move on the board ──────────────────── */
  const handleMove = async (uci) => {
    if (phase !== P.STUDENT || !sessionId) return

    try {
      const { data } = await submitMove(sessionId, uci)
      setFeedback(data)
      setWrongAttempts(data.wrong_attempts || 0)

      if (data.correct) {
        // Apply the student's move visually
        try {
          const chess = new Chess(fen)
          const from = uci.substring(0, 2)
          const to = uci.substring(2, 4)
          const promo = uci.length > 4 ? uci[4] : undefined
          chess.move({ from, to, promotion: promo })
          setFen(chess.fen())
        } catch {
          /* position will update on next step */
        }
        setLastMove(uci)
        setCurrentStep((prev) => prev + 1)
      }

      setPhase(P.FEEDBACK)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error submitting move')
    }
  }

  /* ── Continue after viewing feedback ───────────────────── */
  const handleContinue = () => {
    if (!feedback) return

    if (feedback.line_complete) {
      setPhase(P.COMPLETE)
      return
    }

    if (!feedback.correct) {
      // Retry the same move
      // In test mode after 3 wrong, the answer was revealed
      // In learn mode, hint is always shown
      if (feedback.hint) setHint(feedback.hint)
      setFeedback(null)
      setPhase(P.STUDENT)
      return
    }

    // Correct – play any auto-moves that follow
    if (feedback.auto_moves && feedback.auto_moves.length > 0) {
      const nextFen = feedback.next_step?.fen
      setHint(feedback.hint || null)
      setWrongAttempts(0)
      setFeedback(null)
      animateAutoMoves(feedback.auto_moves, nextFen)
    } else if (feedback.next_step) {
      setFen(feedback.next_step.fen)
      setHint(feedback.hint || null)
      setWrongAttempts(0)
      setFeedback(null)
      setPhase(P.STUDENT)
    } else {
      setHint(null)
      setWrongAttempts(0)
      setFeedback(null)
      setPhase(P.STUDENT)
    }
  }

  /* ── Reset / end session ───────────────────────────────── */
  const handleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (sessionId) endSession(sessionId).catch(() => {})
    setSessionId(null)
    setFen('start')
    setLastMove('')
    setPhase(P.SELECT)
    setFeedback(null)
    setCurrentStep(0)
    setSelectedLine(null)
    setHint(null)
    setWrongAttempts(0)
  }

  /* ── Render helpers ────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="spinner" />
        <span className="ml-3 text-gray-500">Loading...</span>
      </div>
    )
  }

  if (!repertoire) return null

  const lines = repertoire.lines || []
  const progress = totalMoves > 0 ? Math.round((currentStep / totalMoves) * 100) : 0

  /* ═══════════════════════════════════════════════════════ */
  /*  LINE SELECTION PHASE                                   */
  /* ═══════════════════════════════════════════════════════ */
  if (phase === P.SELECT) {
    const startBtn = (
      <button
        onClick={handleStartTraining}
        disabled={selectedLine === null}
        className="w-full py-3 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-500 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
      >
        Start Training
      </button>
    )

    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">{repertoire.opening}</h1>
            <p className="text-sm text-gray-500">{repertoire.description}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-500 hover:text-gray-300 transition"
          >
            ← Back to Openings
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left: Line list ── */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold mb-3 text-gray-200">Choose a line</h2>
            <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
              {lines.map((line, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedLine(idx)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition ${
                    selectedLine === idx
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                  }`}
                >
                  <h3 className="font-medium text-gray-200">{line.line_name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{line.description}</p>
                  <span className="text-xs text-gray-600 mt-1 inline-block">
                    {line.move_count ?? line.moves?.length ?? '?'} moves
                  </span>
                </button>
              ))}
            </div>
            {/* Start button below line list (mobile / secondary) */}
            <div className="mt-4 lg:hidden">
              {startBtn}
            </div>
          </div>

          {/* ── Right: Mode selector + Start ── */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="lg:sticky lg:top-24 space-y-5">
              {/* Mode selector */}
              <div className="card p-5">
                <label className="text-sm font-medium text-gray-300 mb-3 block">
                  Training Mode
                </label>
                <div className="flex gap-3">
                  {['learn', 'test', 'review'].map((m) => (
                    <button
                      key={m}
                      onClick={() => setSelectedMode(m)}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition ${
                        selectedMode === m
                          ? 'bg-emerald-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {selectedMode === 'learn' &&
                    'Step-by-step with explanations and hints.'}
                  {selectedMode === 'test' &&
                    'Play without hints — scored on accuracy.'}
                  {selectedMode === 'review' &&
                    'Review previously-learned lines with spaced repetition.'}
                </p>
              </div>

              {/* Selected line summary */}
              {selectedLine !== null && lines[selectedLine] && (
                <div className="card p-5">
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Selected Line</h3>
                  <p className="text-white font-semibold">{lines[selectedLine].line_name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {lines[selectedLine].move_count ?? lines[selectedLine].moves?.length ?? '?'} moves
                  </p>
                </div>
              )}

              {/* Start button (desktop — always visible on right) */}
              <div className="hidden lg:block">
                {startBtn}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ═══════════════════════════════════════════════════════ */
  /*  TRAINING BOARD PHASE                                   */
  /* ═══════════════════════════════════════════════════════ */
  return (
    <div ref={boardRef} className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">{repertoire.opening}</h1>
          <p className="text-sm text-gray-500">{lineName}</p>
        </div>
        <button
          onClick={handleReset}
          className="text-sm text-gray-500 hover:text-red-400 transition"
        >
          ✕ End session
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Board Column ── */}
        <div ref={boardContainerRef} className="flex-shrink-0 w-full lg:w-auto lg:max-w-[480px]">
          <ChessBoard
            fen={fen}
            side={side}
            onMove={handleMove}
            disabled={phase !== P.STUDENT}
            boardWidth={boardWidth}
            lastMove={lastMove}
          />
        </div>

        {/* ── Info Column ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Session info + progress */}
          <div className="card p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="capitalize font-medium text-gray-300">
                {selectedMode} mode
              </span>
              <span>•</span>
              <span>Playing as {side}</span>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>
                  {currentStep} / {totalMoves}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Phase banners */}
          {phase === P.AUTO && (
            <div className="bg-blue-500/10 border-2 border-blue-500/30 rounded-xl p-4 flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-400 font-medium">
                Opponent is playing…
              </span>
            </div>
          )}

          {phase === P.STUDENT && (
            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-xl p-4 text-center">
              <span className="text-amber-400 font-medium">
                Your turn — make your move on the board.
              </span>
              {/* Learn mode: show hint */}
              {selectedMode === 'learn' && hint && (
                <div className="mt-2 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <span className="text-blue-400 text-sm font-semibold">
                    💡 Hint: {hint}
                  </span>
                </div>
              )}
              {/* Test mode: show wrong attempt count + reveal after 3 */}
              {selectedMode === 'test' && wrongAttempts > 0 && wrongAttempts < 3 && (
                <div className="mt-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <span className="text-orange-400 text-xs font-medium">
                    Wrong attempts: {wrongAttempts}/3
                  </span>
                </div>
              )}
              {selectedMode === 'test' && wrongAttempts >= 3 && (
                <div className="mt-2 px-3 py-2 bg-red-500/15 border-2 border-red-500/30 rounded-lg">
                  <span className="text-red-400 text-sm font-bold">
                    ❌ Answer: {hint || 'See feedback'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Feedback panel */}
          {phase === P.FEEDBACK && feedback && (
            <MoveFeedback result={feedback} onContinue={handleContinue} />
          )}

          {/* Completion */}
          {phase === P.COMPLETE && (
            <div className="bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl p-6 text-center">
              <span className="text-4xl mb-2 block">🎉</span>
              <h3 className="text-xl font-bold text-emerald-400">Line Complete!</h3>
              <p className="text-sm text-emerald-300/70 mt-2">
                Great job completing the <strong>{lineName}</strong> line.
              </p>
              <div className="mt-4 flex gap-3 justify-center">
                <button
                  onClick={handleReset}
                  className="btn-primary"
                >
                  Train Another Line
                </button>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-secondary"
                >
                  View Progress
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
