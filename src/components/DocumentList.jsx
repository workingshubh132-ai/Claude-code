import { useEffect, useState } from 'react'
import { listDocuments, createDocument, subscribeToDocuments } from '../lib/api'
import DocumentRow from './DocumentRow'

export default function DocumentList({ assetId, userId }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [error, setError] = useState(null)

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
    if (!name.trim() || !category.trim()) return
    setError(null)
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
        />
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        <button className="brass-button small" type="submit">
          Add document
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
