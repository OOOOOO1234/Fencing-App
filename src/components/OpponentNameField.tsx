import { useMemo, useState } from 'react'
import {
  displayOpponentName,
  filterOpponentSuggestions,
  type KnownOpponent,
} from '../lib/opponents'

interface OpponentNameFieldProps {
  id?: string
  label?: string
  hint?: string
  value: string
  opponents: readonly KnownOpponent[]
  onChange: (value: string) => void
  onSelect?: (name: string) => void
  onSubmit?: (name: string) => void
  onCommit?: (name: string) => void
}

export function OpponentNameField({
  id = 'opponent-name',
  label = 'Opponent',
  hint,
  value,
  opponents,
  onChange,
  onSelect,
  onSubmit,
  onCommit,
}: OpponentNameFieldProps) {
  const [open, setOpen] = useState(false)
  const suggestions = useMemo(
    () => filterOpponentSuggestions(opponents, value).slice(0, 8),
    [opponents, value],
  )

  function pick(name: string) {
    onChange(name)
    onSelect?.(name)
    onCommit?.(name)
    setOpen(false)
  }

  return (
    <div className="opponent-field">
      <label htmlFor={id}>
        {label}
        {hint ? <em> {hint}</em> : null}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls={`${id}-list`}
        value={value}
        placeholder="Name"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120)
          onCommit?.(value)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            const name = displayOpponentName(value)
            if (!name) return
            const exact = suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase())
            pick(exact?.name ?? name)
            onSubmit?.(exact?.name ?? name)
          }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && suggestions.length > 0 ? (
        <ul id={`${id}-list`} className="opponent-suggest" role="listbox">
          {suggestions.map((item) => (
            <li key={item.key} role="option">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(item.name)}
              >
                <span>{item.name}</span>
                <em>
                  {item.boutCount} bout{item.boutCount === 1 ? '' : 's'}
                </em>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
