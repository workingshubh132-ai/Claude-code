import { useEffect, useState } from 'react'
import { getSignedUrl } from '../lib/api'

// Full-size lightbox for a document's photos. Fetches the full-resolution
// signed URL lazily per photo (the strip only ever loads thumbnails).
export default function PhotoViewer({ photos, index, onClose, onIndexChange }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  const photo = photos[index]

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    setError(null)
    if (!photo) return
    getSignedUrl(photo.storage_path)
      .then((signed) => !cancelled && setUrl(signed))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
  }, [photo])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndexChange(index + 1)
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onIndexChange])

  if (!photo) return null

  return (
    <div className="photo-viewer-backdrop" onClick={onClose}>
      <div className="photo-viewer" onClick={(e) => e.stopPropagation()}>
        <button className="photo-viewer-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        {photos.length > 1 && index > 0 && (
          <button
            className="photo-viewer-nav photo-viewer-prev"
            onClick={() => onIndexChange(index - 1)}
            aria-label="Previous photo"
          >
            ‹
          </button>
        )}
        {photos.length > 1 && index < photos.length - 1 && (
          <button
            className="photo-viewer-nav photo-viewer-next"
            onClick={() => onIndexChange(index + 1)}
            aria-label="Next photo"
          >
            ›
          </button>
        )}

        <div className="photo-viewer-body">
          {error ? (
            <p className="error-text">{error}</p>
          ) : url ? (
            <img src={url} alt="" />
          ) : (
            <p className="muted">Loading…</p>
          )}
        </div>

        {photos.length > 1 && (
          <div className="photo-viewer-count">
            {index + 1} / {photos.length}
          </div>
        )}
      </div>
    </div>
  )
}
