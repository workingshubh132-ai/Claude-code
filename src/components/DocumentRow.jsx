import { useEffect, useState } from 'react'
import { getSignedUrl, uploadDocumentPhoto, verifyDocument, deleteDocument } from '../lib/api'

const STATUS_LABEL = { missing: 'Missing', uploaded: 'Uploaded', verified: 'Verified' }

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false
  const days = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
  return days < 30
}

export default function DocumentRow({ doc, userId, onChanged }) {
  const [thumbUrl, setThumbUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (doc.thumbnail_path) {
      getSignedUrl(doc.thumbnail_path).then((url) => {
        if (!cancelled) setThumbUrl(url)
      })
    } else {
      setThumbUrl(null)
    }
    return () => {
      cancelled = true
    }
  }, [doc.thumbnail_path])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const updated = await uploadDocumentPhoto({
        assetId: doc.asset_id,
        documentId: doc.id,
        file,
        uploadedBy: userId,
      })
      onChanged(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerify() {
    setBusy(true)
    setError(null)
    try {
      const updated = await verifyDocument(doc.id, userId)
      onChanged(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Remove "${doc.name}" from the vault?`)) return
    setBusy(true)
    setError(null)
    try {
      await deleteDocument(doc.id)
      onChanged(null, doc.id)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const expiring = isExpiringSoon(doc.expiry_date)

  return (
    <div className={`document-row status-${doc.status}`}>
      <div className="document-thumb">
        {thumbUrl ? (
          <img src={thumbUrl} alt={doc.name} />
        ) : (
          <div className="document-thumb-empty">No photo</div>
        )}
      </div>

      <div className="document-info">
        <div className="document-name-row">
          <strong>{doc.name}</strong>
          <span className={`status-badge status-badge-${doc.status}`}>{STATUS_LABEL[doc.status]}</span>
        </div>
        <div className="document-meta">
          <span>{doc.category}</span>
          {doc.expiry_date && (
            <span className={expiring ? 'expiry-warning' : ''}>
              Expires {new Date(doc.expiry_date).toLocaleDateString()}
            </span>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="document-actions">
        <label className="brass-button small">
          {doc.status === 'missing' ? 'Capture' : 'Retake'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            disabled={busy}
            hidden
          />
        </label>
        {doc.status === 'uploaded' && (
          <button className="brass-button small" onClick={handleVerify} disabled={busy}>
            Verify
          </button>
        )}
        <button className="link-button small" onClick={handleDelete} disabled={busy}>
          Remove
        </button>
      </div>
    </div>
  )
}
