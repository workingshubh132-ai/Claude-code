// Client-side resize/compress before upload. Runs entirely in the browser via canvas.
export function resizeImage(file, { maxDimension, quality }) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Could not read image'))
    }
    img.src = objectUrl
  })
}

export const FULL_SIZE = { maxDimension: 1600, quality: 0.82 }
export const THUMB_SIZE = { maxDimension: 320, quality: 0.7 }
