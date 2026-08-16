import { supabase } from '../supabaseClient'
import { resizeImage, FULL_SIZE, THUMB_SIZE } from './image'

export const ROOT_TYPE_BY_ROLE = {
  owner: 'property',
  broker: 'deal',
  builder: 'project',
  society: 'building',
}

export const CHILD_TYPE_BY_ROOT_TYPE = {
  project: 'unit',
  building: 'resident',
}

export async function listRootAssets(rootType) {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('type', rootType)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function listChildAssets(parentId) {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('parent_id', parentId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createAsset({ ownerId, parentId = null, type, name, metadata = {} }) {
  const { data, error } = await supabase
    .from('assets')
    .insert({ owner_id: ownerId, parent_id: parentId, type, name, metadata })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAsset(id, patch) {
  const { data, error } = await supabase.from('assets').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteAsset(id) {
  const { error } = await supabase.from('assets').delete().eq('id', id)
  if (error) throw error
}

export async function listDocuments(assetId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createDocument({ assetId, name, category, expiryDate, uploadedBy }) {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      asset_id: assetId,
      name,
      category,
      expiry_date: expiryDate || null,
      status: 'missing',
      uploaded_by: uploadedBy,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateDocument(id, patch) {
  const { data, error } = await supabase.from('documents').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteDocument(id) {
  const { error } = await supabase.from('documents').delete().eq('id', id)
  if (error) throw error
}

export async function verifyDocument(id, verifierId) {
  return updateDocument(id, {
    status: 'verified',
    verified_by: verifierId,
    verified_at: new Date().toISOString(),
  })
}

export async function listPhotos(documentId) {
  const { data, error } = await supabase
    .from('document_photos')
    .select('*')
    .eq('document_id', documentId)
    .order('position', { ascending: true })
  if (error) throw error
  return data
}

// Compresses one photo into full + thumbnail variants, uploads both to the
// private "documents" bucket, and records a document_photos row.
async function uploadOnePhoto({ assetId, documentId, file, position, uploadedBy }) {
  const photoId = crypto.randomUUID()
  const fullPath = `${assetId}/${documentId}/${photoId}/full.jpg`
  const thumbPath = `${assetId}/${documentId}/${photoId}/thumb.jpg`

  const [fullBlob, thumbBlob] = await Promise.all([
    resizeImage(file, FULL_SIZE),
    resizeImage(file, THUMB_SIZE),
  ])

  const [fullUpload, thumbUpload] = await Promise.all([
    supabase.storage
      .from('documents')
      .upload(fullPath, fullBlob, { contentType: 'image/jpeg', upsert: true }),
    supabase.storage
      .from('documents')
      .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: true }),
  ])
  if (fullUpload.error) throw fullUpload.error
  if (thumbUpload.error) throw thumbUpload.error

  const { data, error } = await supabase
    .from('document_photos')
    .insert({
      id: photoId,
      document_id: documentId,
      storage_path: fullPath,
      thumbnail_path: thumbPath,
      position,
      uploaded_by: uploadedBy,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Uploads a batch one at a time -- resizing several full-size photos at once is
// a good way to get the tab killed on a phone. onProgress fires with
// (done, total) so the UI can show where it is.
export async function uploadDocumentPhotos({
  assetId,
  documentId,
  files,
  startPosition = 0,
  uploadedBy,
  onProgress,
}) {
  const uploaded = []
  for (let i = 0; i < files.length; i++) {
    uploaded.push(
      await uploadOnePhoto({
        assetId,
        documentId,
        file: files[i],
        position: startPosition + i,
        uploadedBy,
      })
    )
    onProgress?.(i + 1, files.length)
  }
  return uploaded
}

export async function deletePhoto(photo) {
  const { error } = await supabase.from('document_photos').delete().eq('id', photo.id)
  if (error) throw error
  // Best effort: the row is what the UI reads, and only the asset owner is
  // permitted to remove the underlying storage objects.
  await supabase.storage.from('documents').remove([photo.storage_path, photo.thumbnail_path])
}

const urlCache = new Map()

// Signed URLs expire; cache briefly per path so re-renders don't re-request constantly.
export async function getSignedUrl(path, expiresIn = 3600) {
  if (!path) return null
  const cached = urlCache.get(path)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, expiresIn)
  if (error) throw error
  urlCache.set(path, { url: data.signedUrl, expiresAt: Date.now() + (expiresIn - 60) * 1000 })
  return data.signedUrl
}

// Live updates for whatever asset subtree is currently open, so edits from
// another tab/device show up without a manual refresh.
export function subscribeToDocuments(assetId, onChange) {
  const channel = supabase
    .channel(`documents-${assetId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'documents', filter: `asset_id=eq.${assetId}` },
      onChange
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeToChildAssets(parentId, onChange) {
  const channel = supabase
    .channel(`assets-${parentId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'assets', filter: `parent_id=eq.${parentId}` },
      onChange
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
