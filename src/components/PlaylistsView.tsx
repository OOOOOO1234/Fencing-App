import { useEffect, useState, type FormEvent } from 'react'
import { computeStats, formatPct } from '../lib/stats'
import {
  deletePlaylist,
  listBouts,
  listPlaylists,
  newId,
  savePlaylist,
} from '../lib/storage'
import type { Bout, Playlist } from '../types'

interface PlaylistsViewProps {
  onOpenBout: (id: string) => void
  onBack: () => void
}

export function PlaylistsView({ onOpenBout, onBack }: PlaylistsViewProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [bouts, setBouts] = useState<Bout[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setPlaylists(await listPlaylists())
    setBouts(await listBouts())
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Name the competition playlist.')
      return
    }
    if (selected.length === 0) {
      setError('Pick at least one bout.')
      return
    }
    await savePlaylist({
      id: newId(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      boutIds: selected,
    })
    setName('')
    setSelected([])
    await refresh()
  }

  function combinedStats(playlist: Playlist) {
    const phrases = playlist.boutIds.flatMap(
      (id) => bouts.find((b) => b.id === id)?.phrases ?? [],
    )
    return computeStats(phrases)
  }

  return (
    <section className="playlists-view" aria-labelledby="playlists-heading">
      <button type="button" className="btn ghost" onClick={onBack}>
        ← Back
      </button>
      <div className="section-head">
        <h2 id="playlists-heading">Competition playlists</h2>
        <p className="muted">
          Group bouts for one fencer into a competition. Combined stats use every phrase in those
          bouts.
        </p>
      </div>

      <form className="upload-form" onSubmit={(e) => void handleCreate(e)}>
        <label>
          Playlist name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. NAC Div I — Day 1"
          />
        </label>
        <fieldset>
          <legend>Bouts to include</legend>
          {bouts.length === 0 ? (
            <p className="muted">No bouts yet. Upload or load the demo first.</p>
          ) : (
            <ul className="check-list">
              {bouts.map((bout) => (
                <li key={bout.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(bout.id)}
                      onChange={(e) => {
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, bout.id]
                            : prev.filter((id) => id !== bout.id),
                        )
                      }}
                    />
                    {bout.title}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn primary">
          Create playlist
        </button>
      </form>

      <ul className="bout-list" style={{ marginTop: '1.25rem' }}>
        {playlists.map((playlist) => {
          const stats = combinedStats(playlist)
          return (
            <li key={playlist.id} className="playlist-card">
              <div>
                <span className="bout-title">{playlist.name}</span>
                <span className="muted">
                  {playlist.boutIds.length} bout{playlist.boutIds.length === 1 ? '' : 's'} ·{' '}
                  {stats.totals.attempts} phrases · success {formatPct(stats.totals.successRate)}
                </span>
              </div>
              <div className="form-actions">
                {playlist.boutIds.map((id) => {
                  const bout = bouts.find((b) => b.id === id)
                  return (
                    <button
                      key={id}
                      type="button"
                      className="btn tiny secondary"
                      onClick={() => onOpenBout(id)}
                    >
                      {bout?.title ?? id.slice(0, 6)}
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="btn tiny danger-ghost"
                  onClick={() => {
                    void (async () => {
                      await deletePlaylist(playlist.id)
                      await refresh()
                    })()
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
