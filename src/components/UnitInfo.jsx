import { useState } from 'react'
import { updateAsset } from '../lib/api'

const STATUS_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'booked', label: 'Booked' },
  { value: 'sold', label: 'Sold' },
]

export default function UnitInfo({ unit, onChanged }) {
  const [status, setStatus] = useState(unit.status || 'available')
  const [buyerName, setBuyerName] = useState(unit.buyer_name || '')
  const [buyerPhone, setBuyerPhone] = useState(unit.buyer_phone || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const dirty =
    status !== (unit.status || 'available') ||
    buyerName !== (unit.buyer_name || '') ||
    buyerPhone !== (unit.buyer_phone || '')

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateAsset(unit.id, {
        status,
        buyer_name: status === 'available' ? null : buyerName.trim() || null,
        buyer_phone: status === 'available' ? null : buyerPhone.trim() || null,
      })
      onChanged(updated)
      setSaved(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="info-panel ledger-card" onSubmit={handleSave}>
      <label className="field">
        <span>Sale status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {status !== 'available' && (
        <>
          <label className="field">
            <span>Buyer name</span>
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
          </label>
          <label className="field">
            <span>Buyer phone</span>
            <input
              type="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
            />
          </label>
        </>
      )}

      {error && <p className="error-text">{error}</p>}
      <div className="info-panel-actions">
        <button className="brass-button small" type="submit" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved && !dirty && <span className="muted">Saved.</span>}
      </div>
    </form>
  )
}
