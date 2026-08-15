import { useState } from 'react'

export default function AssetList({ assets, label, onAdd, onSelect }) {
  const [name, setName] = useState('')
  const [error, setError] = useState(null)

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      await onAdd(name.trim())
      setName('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="asset-list">
      <form className="add-form" onSubmit={handleAdd}>
        <input
          placeholder={`New ${label} name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="brass-button small" type="submit">
          Add {label}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {assets.length === 0 ? (
        <p className="muted">No {label.toLowerCase()}s yet.</p>
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
