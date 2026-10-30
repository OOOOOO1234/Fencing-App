import { useState } from 'react'
import { ACTIONS } from '../lib/actions'
import { formatRefChip } from '../lib/refLexicon'
import { formatTime } from '../lib/stats'
import type { ActionName, Outcome, Phrase } from '../types'
import { OUTCOME_LABELS, OUTCOMES } from '../types'

interface PhraseEditProps {
  phrase: Phrase
  onSeek: (seconds: number) => void
  onSave: (next: Phrase) => void
  onRemove: () => void
  /** Highlight when this phrase is part of a studied opponent sequence. */
  highlighted?: boolean
}

/** Compact inline edit — action / opponent / result (+ optional ref words). */
export function PhraseRow({
  phrase,
  onSeek,
  onSave,
  onRemove,
  highlighted = false,
}: PhraseEditProps) {
  const [editing, setEditing] = useState(false)
  const [action, setAction] = useState<ActionName>(phrase.action)
  const [opponentAction, setOpponentAction] = useState<ActionName | ''>(
    phrase.opponentAction ?? '',
  )
  const [outcome, setOutcome] = useState<Outcome>(phrase.outcome)
  const [refWords, setRefWords] = useState(phrase.refWords ?? '')

  const chip = formatRefChip(phrase)

  function startEdit() {
    setAction(phrase.action)
    setOpponentAction(phrase.opponentAction ?? '')
    setOutcome(phrase.outcome)
    setRefWords(phrase.refWords ?? '')
    setEditing(true)
  }

  function save() {
    onSave({
      ...phrase,
      action,
      opponentAction: opponentAction || undefined,
      outcome,
      refWords: refWords.trim() || undefined,
      fromAnalysis: false,
      edited: true,
      needsReview: false,
      sources: [...new Set([...(phrase.sources ?? []), 'edit' as const])],
      remark: phrase.fromAnalysis ? undefined : phrase.remark,
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <li className={highlighted ? 'log-edit log-highlight' : 'log-edit'}>
        <span className="log-time">{formatTime(phrase.timestamp)}</span>
        <label className="log-field">
          <span className="sr-only">You</span>
          <select value={action} onChange={(e) => setAction(e.target.value as ActionName)}>
            {ACTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="log-field">
          <span className="sr-only">Opponent</span>
          <select
            value={opponentAction}
            onChange={(e) => setOpponentAction(e.target.value as ActionName | '')}
          >
            <option value="">—</option>
            {ACTIONS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="log-field">
          <span className="sr-only">Result</span>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome)}>
            {OUTCOMES.map((key) => (
              <option key={key} value={key}>
                {OUTCOME_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className="log-field log-ref-input">
          <span className="sr-only">Ref said</span>
          <input
            type="text"
            value={refWords}
            placeholder="Ref said…"
            onChange={(e) => setRefWords(e.target.value)}
          />
        </label>
        <button type="button" className="text-btn" onClick={save}>
          Save
        </button>
        <button type="button" className="text-btn muted-btn" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </li>
    )
  }

  return (
    <li className={highlighted ? 'log-highlight' : undefined}>
      <button type="button" className="log-main" onClick={() => onSeek(phrase.timestamp)}>
        <span>{formatTime(phrase.timestamp)}</span>
        <span>
          {phrase.action}
          {phrase.opponentAction ? ` vs ${phrase.opponentAction}` : ''}
          {phrase.fromAnalysis ? ' · draft' : ''}
          {phrase.needsReview ? ' · review' : ''}
        </span>
        <span>{OUTCOME_LABELS[phrase.outcome]}</span>
      </button>
      {chip ? (
        <span className="ref-chip" title={phrase.refWords || phrase.refSignal || chip}>
          Ref: {chip}
        </span>
      ) : null}
      <button type="button" className="text-btn" onClick={startEdit}>
        Edit
      </button>
      <button type="button" className="text-btn muted-btn" onClick={onRemove}>
        Remove
      </button>
    </li>
  )
}
