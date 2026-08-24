import { useEffect, useState } from 'react'
import { listDocuments, createDocument, subscribeToDocuments } from '../lib/api'
import DocumentRow from './DocumentRow'

const CATEGORY_PRESETS = {
  property: ['Sale Deed', 'Title Deed', 'Property Tax Receipt', 'Encumbrance Certificate', 'ID Proof'],
  deal: ['Sale Agreement', 'Token Receipt', 'Buyer ID Proof', 'Seller ID Proof', 'Commission Agreement'],
  project: [
    'RERA Certificate',
    'Commencement Certificate',
    'Sanctioned Plan',
    'Environmental Clearance',
    'Fire NOC',
    'Occupancy Certificate',
    'Completion Certificate',
  ],
  unit: ['Allotment Letter', 'Sale Agreement', 'Payment Receipt', 'Possession Letter'],
  building: ['Society Registration', 'Occupancy Certificate', 'Fire NOC', 'AGM Minutes'],
  resident: ['Sale Deed', 'NOC', 'ID Proof', 'Maintenance Agreement'],
}

export default function DocumentList({ assetId, userId, assetType }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const presets = CATEGORY_PRESETS[assetType] || []

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listDocuments(assetId)
      .then((data) => !cancelled && setDocs(data))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))

    const unsubscribe = subscribeToDocuments(assetId, () => {
      listDocuments(assetId).then((data) => !cancelled && setDocs(data))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [assetId])

  function handleChanged(updated, removedId) {
    setDocs((prev) => {
      if (removedId) return prev.filter((d) => d.id !== removedId)
      return prev.map((d) => (d.id === updated.id ? updated : d))
    })
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!name.trim() || !category.trim() || busy) return
    setError(null)
    setBusy(true)
    try {
      const doc = await createDocument({
        assetId,
        name: name.trim(),
        category: category.trim(),
        expiryDate,
        uploadedBy: userId,
      })
      setDocs((prev) => [...prev, doc])
      setName('')
      setCategory('')
      setExpiryDate('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="document-list">
      <form className="add-form" onSubmit={handleAdd}>
        <input
          placeholder="Document name (e.g. Sale Deed)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          placeholder="Category (e.g. Title)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list={presets.length > 0 ? 'category-presets' : undefined}
        />
        {presets.length > 0 && (
          <datalist id="category-presets">
            {presets.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        )}
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        <button className="brass-button small" type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add document'}
        </button>
      </form>

      {error && <p className="error-text">{error}</p>}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="muted">No documents yet.</p>
      ) : (
        docs.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} userId={userId} onChanged={handleChanged} />
        ))
      )}
    </div>
  )
}
