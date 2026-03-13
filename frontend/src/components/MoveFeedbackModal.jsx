/**
 * MoveFeedback – inline feedback panel for training moves.
 */
export default function MoveFeedback({ result, onContinue }) {
  if (!result) return null

  const isCorrect = result.correct
  const isRevealed = result.revealed

  return (
    <div
      className={`rounded-xl p-4 border-2 ${
        isCorrect
          ? 'bg-emerald-500/10 border-emerald-500/30'
          : isRevealed
          ? 'bg-red-500/15 border-red-500/40'
          : 'bg-red-500/10 border-red-500/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{isCorrect ? '✅' : isRevealed ? '🚫' : '❌'}</span>
        <h4 className={`font-bold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
          {isCorrect ? 'Correct!' : isRevealed ? 'Answer Revealed' : 'Incorrect — Try again'}
        </h4>
      </div>

      {!isCorrect && isRevealed && (
        <div className="mb-2 px-3 py-2 bg-red-500/20 rounded-lg">
          <span className="text-red-300 font-bold text-base">
            The correct move was: {result.expected_san}
          </span>
        </div>
      )}

      {!isCorrect && !isRevealed && result.wrong_attempts > 0 && (
        <p className="text-sm text-orange-400 mb-1">
          Attempt {result.wrong_attempts}/3 — try again!
        </p>
      )}

      {(isCorrect || isRevealed) && result.explanation && (
        <p className="text-sm text-gray-400">{result.explanation}</p>
      )}

      {onContinue && (
        <button
          onClick={onContinue}
          className="mt-3 btn-primary text-sm"
        >
          {result.line_complete ? 'Line Complete!' : isCorrect ? 'Continue →' : isRevealed ? 'Continue →' : 'Try Again →'}
        </button>
      )}
    </div>
  )
}
