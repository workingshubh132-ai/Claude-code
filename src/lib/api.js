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

// Compresses the photo into full + thumbnail variants, uploads both to the
// private "documents" bucket under {assetId}/{documentId}/, and records the
// resulting paths on the document row (status flips to "uploaded").
export async function uploadDocumentPhoto({ assetId, documentId, file, uploadedBy }) {
  const [fullBlob, thumbBlob] = await Promise.all([
    resizeImage(file, FULL_SIZE),
    resizeImage(file, THUMB_SIZE),
  ])

  const fullPath = `${assetId}/${documentId}/full.jpg`
  const thumbPath = `${assetId}/${documentId}/thumb.jpg`

  const [fullUpload, thumbUpload] = await Promise.all([
    supabase.storage.from('documents').upload(fullPath, fullBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
    supabase.storage.from('documents').upload(thumbPath, thumbBlob, {
      contentType: 'image/jpeg',
      upsert: true,
    }),
  ])
  if (fullUpload.error) throw fullUpload.error
  if (thumbUpload.error) throw thumbUpload.error

  return updateDocument(documentId, {
    storage_path: fullPath,
    thumbnail_path: thumbPath,
    status: 'uploaded',
    uploaded_by: uploadedBy,
  })
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
