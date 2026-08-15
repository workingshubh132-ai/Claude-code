import { useState } from 'react'

export default function AssetList({ assets, label, plural, onAdd, onSelect }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setError(null)
    setBusy(true)
    try {
      await onAdd(name.trim())
      setName('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="asset-list">
      <form className="add-form" onSubmit={handleAdd}>
        <input
          placeholder={`New ${label.toLowerCase()} name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="brass-button small" type="submit" disabled={busy}>
          {busy ? 'Adding…' : `Add ${label}`}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {assets.length === 0 ? (
        <p className="muted">No {plural.toLowerCase()} yet.</p>
      ) : (
        <div className="ledger-grid">
          {assets.map((asset) => (
            <button key={asset.id} className="ledger-card asset-card" onClick={() => onSelect(asset)}>
              <strong>{asset.name}</strong>
              <span className="muted">Added {new Date(asset.created_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
