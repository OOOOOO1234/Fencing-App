import { ACTION_GLOSSARY, OUTCOME_GLOSSARY } from '../lib/glossary'
import { OUTCOMES, OUTCOME_LABELS } from '../types'

interface GlossaryViewProps {
  onBack: () => void
}

export function GlossaryView({ onBack }: GlossaryViewProps) {
  return (
    <section className="glossary-view" aria-labelledby="glossary-heading">
      <button type="button" className="btn ghost" onClick={onBack}>
        ← Back
      </button>
      <div className="section-head">
        <h2 id="glossary-heading">Sabre action glossary</h2>
        <p className="muted">
          Short definitions for the nine actions this app counts. Outcomes use the referee’s awarded
          touch — sabre right of way is not the light color alone.
        </p>
      </div>

      <ul className="glossary-list">
        {ACTION_GLOSSARY.map((entry) => (
          <li key={entry.action}>
            <h3>{entry.action}</h3>
            <p>{entry.summary}</p>
            <p className="muted tiny">{entry.rowNote}</p>
          </li>
        ))}
      </ul>

      <div className="section-head" style={{ marginTop: '1.5rem' }}>
        <h2>Outcomes</h2>
      </div>
      <ul className="glossary-list">
        {OUTCOMES.map((key) => (
          <li key={key}>
            <h3>{OUTCOME_LABELS[key]}</h3>
            <p>{OUTCOME_GLOSSARY[key]}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
