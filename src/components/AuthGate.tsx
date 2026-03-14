import { useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import { isSupabaseConfigured } from '../lib/supabase'

interface AuthGateProps {
  children: ReactNode
}

export function AuthGate({ children }: AuthGateProps) {
  const { user, loading, error, signIn, signUp, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [submitted, setSubmitted] = useState(false)

  // If Supabase isn't configured, skip auth entirely
  if (!isSupabaseConfigured()) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--gray-400)', fontSize: 16 }}>Loading...</div>
      </div>
    )
  }

  // User is signed in — render app with sign-out available via context
  if (user) {
    return <AuthContext.Provider value={{ user, signOut }}>{children}</AuthContext.Provider>
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setSubmitted(true)
    if (mode === 'signin') {
      await signIn(email, password)
    } else {
      await signUp(email, password)
    }
    setSubmitted(false)
  }

  return (
    <div className="container">
      <div className="brand-header">
        <h1 className="brand-title">
          <span className="brand-green">CROP</span><span className="brand-black">WISE</span>
        </h1>
        <p className="brand-subtitle">Voice Entry</p>
      </div>

      <div className="card" style={{ maxWidth: 400, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, marginBottom: 16, textAlign: 'center' }}>
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              required
            />
          </div>

          {error && (
            <div style={{
              padding: '8px 12px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
              background: 'var(--red-50, #fef2f2)', color: 'var(--red-600, #dc2626)',
              fontSize: 14, border: '1px solid var(--red-200, #fecaca)',
            }}>
              {error}
            </div>
          )}

          <button
            className="btn btn-primary"
            type="submit"
            disabled={submitted || !email || !password}
            style={{ width: '100%', marginBottom: 12, opacity: submitted ? 0.6 : 1 }}
          >
            {submitted ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--gray-500)' }}>
          {mode === 'signin' ? (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setEmail(''); setPassword('') }}
                style={{ background: 'none', border: 'none', color: 'var(--green-600)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('signin'); setEmail(''); setPassword('') }}
                style={{ background: 'none', border: 'none', color: 'var(--green-600)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-400)', marginTop: 24 }}>
        Data is stored locally and synced to the cloud when signed in.
      </p>
    </div>
  )
}

// Context for child components to access user/signOut
import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

interface AuthContextValue {
  user: User
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuthContext() {
  return useContext(AuthContext)
}
