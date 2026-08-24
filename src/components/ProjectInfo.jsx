import { useState } from 'react'
import { updateAsset } from '../lib/api'

export default function ProjectInfo({ project, onChanged }) {
  const [reraNumber, setReraNumber] = useState(project.rera_number || '')
  const [possessionDate, setPossessionDate] = useState(project.possession_date || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  const dirty =
    reraNumber !== (project.rera_number || '') ||
    possessionDate !== (project.possession_date || '')

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateAsset(project.id, {
        rera_number: reraNumber.trim() || null,
        possession_date: possessionDate || null,
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
        <span>RERA registration number</span>
        <input
          value={reraNumber}
          onChange={(e) => setReraNumber(e.target.value)}
          placeholder="e.g. P51700012345"
        />
      </label>

      <label className="field">
        <span>Approved possession date</span>
        <input
          type="date"
          value={possessionDate}
          onChange={(e) => setPossessionDate(e.target.value)}
        />
      </label>

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
