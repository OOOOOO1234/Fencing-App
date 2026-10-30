import type { OpponentSequence } from '../lib/opponentSequences'
import { formatPct, formatTime } from '../lib/stats'

interface OpponentStudyProps {
  sequences: OpponentSequence[]
  selectedKey: string | null
  occurrenceIndex: number
  onSelect: (key: string | null) => void
  onJump: (timestamp: number) => void
  onCycle: (delta: number) => void
}

/** Study repeating opponent action chains and jump to each occurrence. */
export function OpponentStudy({
  sequences,
  selectedKey,
  occurrenceIndex,
  onSelect,
  onJump,
  onCycle,
}: OpponentStudyProps) {
  const selected = sequences.find((s) => s.key === selectedKey) ?? null
  const occurrence =
    selected && selected.occurrences.length > 0
      ? selected.occurrences[
          ((occurrenceIndex % selected.occurrences.length) + selected.occurrences.length) %
            selected.occurrences.length
        ]
      : null

  return (
    <section className="opponent-study" aria-labelledby="study-title">
      <h3 id="study-title" className="situation-title">
        Study opponent
      </h3>
      <p className="situation-lede">
        Highlight a sequence they repeat — jump the video to each run so you can plan the break.
      </p>

      {sequences.length === 0 ? (
        <p className="chart-empty">
          Tag opponent actions on consecutive phrases to unlock repeating patterns.
        </p>
      ) : (
        <ul className="sequence-list" aria-label="Opponent sequences">
          {sequences.map((seq) => {
            const on = seq.key === selectedKey
            return (
              <li key={seq.key}>
                <button
                  type="button"
                  className={on ? 'sequence-row sequence-on' : 'sequence-row'}
                  aria-pressed={on}
                  onClick={() => onSelect(on ? null : seq.key)}
                >
                  <span className="sequence-chain">{seq.key}</span>
                  <span className="sequence-meta">
                    {seq.count}× · they score {formatPct(seq.theirScoreRate)}
                  </span>
                </button>
                {on ? (
                  <div className="sequence-detail">
                    <p className="sequence-edge">{seq.edge}</p>
                    {occurrence ? (
                      <div className="sequence-jump">
                        <button
                          type="button"
                          className="text-btn"
                          onClick={() => onJump(occurrence.startTimestamp)}
                        >
                          Jump {formatTime(occurrence.startTimestamp)}
                        </button>
                        {seq.occurrences.length > 1 ? (
                          <>
                            <button
                              type="button"
                              className="text-btn"
                              onClick={() => onCycle(-1)}
                              aria-label="Previous occurrence"
                            >
                              Prev
                            </button>
                            <span className="sequence-index">
                              {occurrenceIndex % seq.occurrences.length + 1}/
                              {seq.occurrences.length}
                            </span>
                            <button
                              type="button"
                              className="text-btn"
                              onClick={() => onCycle(1)}
                              aria-label="Next occurrence"
                            >
                              Next
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
