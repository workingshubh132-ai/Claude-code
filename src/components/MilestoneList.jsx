import { useEffect, useState } from 'react'
import {
  listMilestones,
  createMilestone,
  setMilestoneStatus,
  deleteMilestone,
  subscribeToMilestones,
} from '../lib/api'

const STATUS_LABEL = { pending: 'Pending', in_progress: 'In progress', completed: 'Completed' }
const NEXT_STATUS = { pending: 'in_progress', in_progress: 'completed', completed: 'pending' }
const NEXT_LABEL = { pending: 'Start', in_progress: 'Mark complete', completed: 'Reopen' }

export default function MilestoneList({ assetId }) {
  const [milestones, setMilestones] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMilestones(assetId)
      .then((data) => !cancelled && setMilestones(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    const unsubscribe = subscribeToMilestones(assetId, () => {
      listMilestones(assetId).then((data) => !cancelled && setMilestones(data))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [assetId])

  const completedCount = milestones.filter((m) => m.status === 'completed').length

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim() || busy) return
    setError(null)
    setBusy(true)
    try {
      const milestone = await createMilestone({
        assetId,
        name: name.trim(),
        plannedDate,
        sequence: milestones.length,
      })
      setMilestones((prev) => [...prev, milestone])
      setName('')
      setPlannedDate('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAdvance(milestone) {
    setError(null)
    try {
      const updated = await setMilestoneStatus(milestone.id, NEXT_STATUS[milestone.status])
      setMilestones((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(milestone) {
    if (!confirm(`Remove milestone "${milestone.name}"?`)) return
    setError(null)
    try {
      await deleteMilestone(milestone.id)
      setMilestones((prev) => prev.filter((m) => m.id !== milestone.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="milestone-list">
      {milestones.length > 0 && (
        <div className="milestone-progress">
          <div className="milestone-progress-bar">
            <div
              className="milestone-progress-fill"
              style={{ width: `${(completedCount / milestones.length) * 100}%` }}
            />
          </div>
          <span className="muted">
            {completedCount} of {milestones.length} stages complete
          </span>
        </div>
      )}

      <form className="add-form" onSubmit={handleAdd}>
        <input
          placeholder="Stage name (e.g. Foundation)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="date"
          value={plannedDate}
          onChange={(e) => setPlannedDate(e.target.value)}
          title="Planned date"
        />
        <button className="brass-button small" type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add stage'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : milestones.length === 0 ? (
        <p className="muted">No construction stages recorded yet.</p>
      ) : (
        <ol className="milestone-timeline">
          {milestones.map((milestone) => (
            <li key={milestone.id} className={`milestone-item status-${milestone.status}`}>
              <span className="milestone-dot" />
              <div className="milestone-info">
                <div className="document-name-row">
                  <strong>{milestone.name}</strong>
                  <span className={`status-badge status-badge-milestone-${milestone.status}`}>
                    {STATUS_LABEL[milestone.status]}
                  </span>
                </div>
                <div className="document-meta">
                  {milestone.planned_date && (
                    <span>Planned {new Date(milestone.planned_date).toLocaleDateString()}</span>
                  )}
                  {milestone.completed_date && (
                    <span>Completed {new Date(milestone.completed_date).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <div className="document-actions">
                <button className="brass-button small" onClick={() => handleAdvance(milestone)}>
                  {NEXT_LABEL[milestone.status]}
                </button>
                <button className="link-button small" onClick={() => handleDelete(milestone)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
