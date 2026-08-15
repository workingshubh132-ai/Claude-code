import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import AuthScreen from './components/AuthScreen'
import AssetList from './components/AssetList'
import DocumentList from './components/DocumentList'
import {
  ROOT_TYPE_BY_ROLE,
  CHILD_TYPE_BY_ROOT_TYPE,
  listRootAssets,
  listChildAssets,
  createAsset,
  subscribeToChildAssets,
} from './lib/api'

const ROOT_LABEL = { property: 'Property', deal: 'Deal', project: 'Project', building: 'Building' }
const ROOT_PLURAL = {
  property: 'Properties',
  deal: 'Deals',
  project: 'Projects',
  building: 'Buildings',
}
const CHILD_LABEL = { unit: 'Unit', resident: 'Resident' }
const CHILD_PLURAL = { unit: 'Units', resident: 'Residents' }

export default function App() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) return <div className="center-screen">Loading the ledger…</div>
  if (!session || !profile) return <AuthScreen />

  return <Vault profile={profile} onSignOut={signOut} />
}

function Vault({ profile, onSignOut }) {
  const rootType = ROOT_TYPE_BY_ROLE[profile.role]
  const childType = CHILD_TYPE_BY_ROOT_TYPE[rootType] // undefined for flat roles (owner/broker)

  const [rootAssets, setRootAssets] = useState([])
  const [selectedRoot, setSelectedRoot] = useState(null)
  const [childAssets, setChildAssets] = useState([])
  const [selectedChild, setSelectedChild] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listRootAssets(rootType)
      .then(setRootAssets)
      .catch((err) => setError(err.message))
  }, [rootType])

  useEffect(() => {
    if (!selectedRoot || !childType) return
    listChildAssets(selectedRoot.id)
      .then(setChildAssets)
      .catch((err) => setError(err.message))

    const unsubscribe = subscribeToChildAssets(selectedRoot.id, () => {
      listChildAssets(selectedRoot.id).then(setChildAssets)
    })
    return unsubscribe
  }, [selectedRoot, childType])

  async function handleAddRoot(name) {
    const asset = await createAsset({ ownerId: profile.id, type: rootType, name })
    setRootAssets((prev) => [...prev, asset])
  }

  async function handleAddChild(name) {
    const asset = await createAsset({
      ownerId: profile.id,
      parentId: selectedRoot.id,
      type: childType,
      name,
    })
    setChildAssets((prev) => [...prev, asset])
  }

  function goHome() {
    setSelectedRoot(null)
    setSelectedChild(null)
  }

  function goToRoot() {
    setSelectedChild(null)
  }

  // The asset documents currently render against: the child if nested roles
  // have drilled that far, otherwise the root itself.
  const documentAsset = childType ? selectedChild : selectedRoot

  return (
    <div className="vault-shell">
      <header className="vault-header">
        <h1 className="ledger-title">The Vault</h1>
        <div className="vault-header-right">
          <span className="muted">
            {profile.display_name || 'Unnamed'} · {profile.role}
          </span>
          <button className="link-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="breadcrumb">
        <button className="link-button" onClick={goHome}>
          Home
        </button>
        {selectedRoot && (
          <>
            <span> / </span>
            <button className="link-button" onClick={goToRoot}>
              {selectedRoot.name}
            </button>
          </>
        )}
        {selectedChild && (
          <>
            <span> / </span>
            <span>{selectedChild.name}</span>
          </>
        )}
      </nav>

      {error && <p className="error-text">{error}</p>}

      <main className="vault-main">
        {!selectedRoot && (
          <AssetList
            assets={rootAssets}
            label={ROOT_LABEL[rootType]}
            plural={ROOT_PLURAL[rootType]}
            onAdd={handleAddRoot}
            onSelect={setSelectedRoot}
          />
        )}

        {selectedRoot && childType && !selectedChild && (
          <AssetList
            assets={childAssets}
            label={CHILD_LABEL[childType]}
            plural={CHILD_PLURAL[childType]}
            onAdd={handleAddChild}
            onSelect={setSelectedChild}
          />
        )}

        {documentAsset && (
          <>
            <ShareLinkNotice />
            <DocumentList assetId={documentAsset.id} userId={profile.id} />
          </>
        )}
      </main>
    </div>
  )
}

// Real scoped/expiring share links need the share_links table plus an Edge
// Function to redeem the token. Until that exists this stays visibly inert
// rather than handing back a link-shaped string that doesn't resolve.
function ShareLinkNotice() {
  return (
    <div className="share-notice">
      <button className="link-button" type="button" disabled>
        Generate verified share link
      </button>
      <span className="muted"> — not available yet</span>
    </div>
  )
}
