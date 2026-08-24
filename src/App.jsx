import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import AuthScreen from './components/AuthScreen'
import AssetList from './components/AssetList'
import DocumentList from './components/DocumentList'
import PaymentList from './components/PaymentList'
import MilestoneList from './components/MilestoneList'
import UnitInfo from './components/UnitInfo'
import ProjectInfo from './components/ProjectInfo'
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

// Which tabs a focused asset gets, in display order. A project/building also
// carries its own documents/hisab (e.g. the RERA certificate lives on the
// project itself, not on any one unit) alongside drilling into its children.
const TABS_BY_TYPE = {
  property: ['documents', 'hisab'],
  deal: ['documents', 'hisab'],
  project: ['units', 'documents', 'hisab', 'milestones', 'info'],
  unit: ['documents', 'hisab', 'info'],
  building: ['residents', 'documents', 'hisab'],
  resident: ['documents', 'hisab'],
}
const TAB_LABEL = {
  documents: 'Documents',
  hisab: 'Hisab',
  milestones: 'Milestones',
  info: 'Info',
  units: 'Units',
  residents: 'Residents',
}

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
  const [tab, setTab] = useState('documents')
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
      // A freshly added unit is presumed sellable until marked otherwise;
      // residents have no sale status, so this only matters for childType 'unit'.
      extra: childType === 'unit' ? { status: 'available' } : {},
    })
    setChildAssets((prev) => [...prev, asset])
  }

  function handleRootChanged(updated) {
    setSelectedRoot(updated)
    setRootAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  function handleChildChanged(updated) {
    setSelectedChild(updated)
    setChildAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
  }

  function goHome() {
    setSelectedRoot(null)
    setSelectedChild(null)
  }

  function goToRoot() {
    setSelectedChild(null)
  }

  // The asset whose tabs are currently on screen: the child if navigation has
  // drilled that far, otherwise the root itself (which has its own tabs too,
  // not just a list of children to drill into).
  const currentAsset = selectedChild || selectedRoot
  const tabs = currentAsset ? TABS_BY_TYPE[currentAsset.type] || [] : []

  // Moving to a different asset shouldn't leave you on a tab it doesn't have.
  // Deliberately keyed on the id, not the object: Info panels replace
  // currentAsset with a new object after saving (see handleRootChanged /
  // handleChildChanged), and re-running this on every reference change would
  // bounce the user back to the first tab right after they hit Save.
  useEffect(() => {
    if (currentAsset) setTab(TABS_BY_TYPE[currentAsset.type]?.[0] || 'documents')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAsset?.id])

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

        {currentAsset && (
          <>
            <ShareLinkNotice />

            <div className="tab-bar">
              {tabs.map((key) => (
                <button
                  key={key}
                  className={`tab ${tab === key ? 'active' : ''}`}
                  onClick={() => setTab(key)}
                >
                  {TAB_LABEL[key]}
                </button>
              ))}
            </div>

            {(tab === 'units' || tab === 'residents') && (
              <AssetList
                assets={childAssets}
                label={CHILD_LABEL[childType]}
                plural={CHILD_PLURAL[childType]}
                onAdd={handleAddChild}
                onSelect={setSelectedChild}
              />
            )}
            {tab === 'documents' && (
              <DocumentList
                assetId={currentAsset.id}
                userId={profile.id}
                assetType={currentAsset.type}
              />
            )}
            {tab === 'hisab' && <PaymentList assetId={currentAsset.id} userId={profile.id} />}
            {tab === 'milestones' && <MilestoneList assetId={currentAsset.id} />}
            {tab === 'info' && currentAsset.type === 'project' && (
              <ProjectInfo project={currentAsset} onChanged={handleRootChanged} />
            )}
            {tab === 'info' && currentAsset.type === 'unit' && (
              <UnitInfo unit={currentAsset} onChanged={handleChildChanged} />
            )}
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
