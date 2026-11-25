'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'

export default function RegisterPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}>
        <div className="card" style={{ padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px', color: 'var(--green)' }}>✓</div>
          <h2 style={{ marginBottom: '8px' }}>Account Created</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Check your email to confirm your account. Redirecting to login...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '64px', height: '64px',
            background: '#fff',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <Logo size={32} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '0.08em' }}>ORBIT</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Professional Investment Dashboard
          </div>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Create Account</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '24px' }}>Start monitoring your investments</p>

          {error && (
            <div style={{
              background: 'var(--red-dim)', border: '1px solid var(--red-border)',
              borderRadius: '12px', padding: '10px 14px', marginBottom: '16px',
              fontSize: '12px', color: 'var(--red)',
            }}>{error}</div>
          )}

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Email</label>
              <input className="input-dark" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="section-label" style={{ display: 'block', marginBottom: '6px' }}>Password</label>
              <input className="input-dark" type="password" placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
            </div>
            <button className="btn-primary" type="submit" disabled={loading} style={{ marginTop: '8px', width: '100%', fontSize: '14px', padding: '12px' }}>
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--green)', textDecoration: 'none', fontWeight: '600' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
