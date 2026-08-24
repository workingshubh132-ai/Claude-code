import { useState } from 'react'

const UNIT_STATUS_LABEL = { available: 'Available', booked: 'Booked', sold: 'Sold' }

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

  const hasStatus = assets.some((a) => a.status)
  const counts = hasStatus
    ? assets.reduce(
        (acc, a) => {
          if (a.status) acc[a.status] = (acc[a.status] || 0) + 1
          return acc
        },
        { available: 0, booked: 0, sold: 0 }
      )
    : null

  return (
    <div className="asset-list">
      {counts && (
        <div className="hisab-summary">
          <div className="hisab-total">
            <span className="muted">Available</span>
            <strong>{counts.available}</strong>
          </div>
          <div className="hisab-total">
            <span className="muted">Booked</span>
            <strong className="amount-pending">{counts.booked}</strong>
          </div>
          <div className="hisab-total">
            <span className="muted">Sold</span>
            <strong className="amount-received">{counts.sold}</strong>
          </div>
        </div>
      )}

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
              <div className="asset-card-title">
                <strong>{asset.name}</strong>
                {asset.status && (
                  <span className={`status-badge status-badge-unit-${asset.status}`}>
                    {UNIT_STATUS_LABEL[asset.status]}
                  </span>
                )}
              </div>
              {asset.status && asset.status !== 'available' && asset.buyer_name && (
                <span className="muted">{asset.buyer_name}</span>
              )}
              <span className="muted">Added {new Date(asset.created_at).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
