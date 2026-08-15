import { useState } from 'react'
import { useAuth } from '../AuthProvider'

const ROLES = [
  { value: 'owner', label: 'Owner', blurb: 'Track documents for properties you own.' },
  { value: 'broker', label: 'Broker', blurb: 'Track documents for deals you broker.' },
  { value: 'builder', label: 'Builder', blurb: 'Track documents across projects and units.' },
  { value: 'society', label: 'Society', blurb: 'Track documents across buildings and residents.' },
]

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState('owner')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [signedUp, setSignedUp] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn({ email, password })
      } else {
        await signUp({ email, password, role, displayName })
        setSignedUp(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (signedUp) {
    return (
      <div className="auth-shell">
        <div className="ledger-card auth-card">
          <h1 className="ledger-title">The Vault</h1>
          <p>Check your email to confirm the account, then sign in.</p>
          <button className="brass-button" onClick={() => { setSignedUp(false); setMode('signin') }}>
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-shell">
      <form className="ledger-card auth-card" onSubmit={handleSubmit}>
        <h1 className="ledger-title">The Vault</h1>
        <p className="ledger-subtitle">A ledger for property documents.</p>

        <label className="field">
          <span>Email</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {mode === 'signup' && (
          <>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>

            <div className="field">
              <span>Role</span>
              <div className="role-grid">
                {ROLES.map((r) => (
                  <label key={r.value} className={`role-option ${role === r.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={role === r.value}
                      onChange={() => setRole(r.value)}
                    />
                    <strong>{r.label}</strong>
                    <span>{r.blurb}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="error-text">{error}</p>}

        <button className="brass-button" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
