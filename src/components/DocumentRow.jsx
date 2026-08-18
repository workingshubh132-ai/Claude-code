import { useEffect, useState } from 'react'
import {
  getSignedUrl,
  listPhotos,
  uploadDocumentPhotos,
  deletePhoto,
  verifyDocument,
  updateDocument,
  deleteDocument,
} from '../lib/api'
import PhotoViewer from './PhotoViewer'

const STATUS_LABEL = { missing: 'Missing', uploaded: 'Uploaded', verified: 'Verified' }

function isExpiringSoon(expiryDate) {
  if (!expiryDate) return false
  const days = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
  return days < 30
}

export default function DocumentRow({ doc, userId, onChanged }) {
  const [photos, setPhotos] = useState([])
  const [urls, setUrls] = useState({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [viewerIndex, setViewerIndex] = useState(null)

  useEffect(() => {
    let cancelled = false
    listPhotos(doc.id)
      .then((data) => !cancelled && setPhotos(data))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [doc.id])

  // Sign each thumbnail once it appears in the list.
  useEffect(() => {
    let cancelled = false
    const missing = photos.filter((p) => !urls[p.thumbnail_path])
    if (missing.length === 0) return

    Promise.all(
      missing.map(async (p) => [p.thumbnail_path, await getSignedUrl(p.thumbnail_path)])
    )
      .then((pairs) => {
        if (cancelled) return
        // Not Object.fromEntries: missing on Android WebView below 73.
        setUrls((prev) => {
          const next = { ...prev }
          for (const [path, url] of pairs) next[path] = url
          return next
        })
      })
      .catch((err) => !cancelled && setError(err.message))

    return () => {
      cancelled = true
    }
  }, [photos, urls])

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    setBusy(true)
    setError(null)
    setProgress({ done: 0, total: files.length })
    try {
      const added = await uploadDocumentPhotos({
        assetId: doc.asset_id,
        documentId: doc.id,
        files,
        startPosition: photos.length,
        uploadedBy: userId,
        onProgress: (done, total) => setProgress({ done, total }),
      })
      setPhotos((prev) => [...prev, ...added])

      // First photo on a document moves it out of "missing".
      if (doc.status === 'missing') {
        onChanged(await updateDocument(doc.id, { status: 'uploaded', uploaded_by: userId }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function handleRemovePhoto(photo) {
    setBusy(true)
    setError(null)
    try {
      await deletePhoto(photo)
      const remaining = photos.filter((p) => p.id !== photo.id)
      setPhotos(remaining)
      // Last photo gone: the document is missing its evidence again.
      if (remaining.length === 0 && doc.status !== 'missing') {
        onChanged(
          await updateDocument(doc.id, { status: 'missing', verified_by: null, verified_at: null })
        )
      }
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
      onChanged(await verifyDocument(doc.id, userId))
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
          <span>
            {photos.length === 0
              ? 'No photos'
              : `${photos.length} photo${photos.length === 1 ? '' : 's'}`}
          </span>
        </div>

        <div className="photo-strip">
          {photos.map((photo, index) => (
            <div key={photo.id} className="photo-thumb">
              {urls[photo.thumbnail_path] ? (
                <button
                  type="button"
                  className="photo-thumb-open"
                  onClick={() => setViewerIndex(index)}
                  aria-label={`View photo ${index + 1}`}
                >
                  <img src={urls[photo.thumbnail_path]} alt={doc.name} />
                </button>
              ) : (
                <div className="photo-thumb-empty">…</div>
              )}
              <button
                type="button"
                className="photo-remove"
                title="Remove photo"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemovePhoto(photo)
                }}
                disabled={busy}
              >
                ×
              </button>
            </div>
          ))}

          {/* No `capture` attribute: that forces the camera and hides the
              gallery on mobile. Without it the OS offers both. */}
          <label className={`photo-add ${busy ? 'disabled' : ''}`}>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFiles}
              disabled={busy}
              hidden
            />
            <span>+</span>
            <span className="photo-add-label">Add</span>
          </label>
        </div>

        {progress && (
          <p className="muted">
            Uploading {progress.done} of {progress.total}…
          </p>
        )}
        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="document-actions">
        {photos.length > 0 && doc.status !== 'verified' && (
          <button className="brass-button small" onClick={handleVerify} disabled={busy}>
            Verify
          </button>
        )}
        <button className="link-button small" onClick={handleDelete} disabled={busy}>
          Remove
        </button>
      </div>

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </div>
  )
}
