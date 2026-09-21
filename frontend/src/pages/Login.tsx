import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const setUser = useAuthStore((s) => s.setUser)
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.identifier.trim() || !form.password) return
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(form)
      const { user, access_token } = res.data.data
      setUser(user, access_token)
      window.location.href = '/dashboard'
    } catch (err: any) {
      const code = err.response?.data?.error?.code
      const msg  = err.response?.data?.error?.message || 'Xəta baş verdi'
      if (code === 'EMAIL_NOT_VERIFIED') {
        const id = form.identifier.trim()
        const email = id.includes('@') ? id : ''
        window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
      <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex' }}>
        {/* Left — branding */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
          padding: '48px', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        }} className="hidden md:flex">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>TTShelf</span>
          </div>
          <h2 style={{ color: 'white', fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginBottom: 16, letterSpacing: '-0.5px' }}>
            Kitablarından<br />qeydlər apar
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 15, lineHeight: 1.7, maxWidth: 320 }}>
            Sonsuz canvas, PDF oxucu, fiqurlar, oxlar — hər şey bir yerdə.
          </p>
          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {['Sonsuz canvas üzərində qeyd apar', 'PDF kitabı yan paneldə aç', 'Qeydlərini PDF kimi ixrac et'].map((t) => (
                <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                  <span style={{ color: '#cbd5e1', fontSize: 13 }}>{t}</span>
                </div>
            ))}
          </div>
        </div>

        {/* Right — form */}
        <div style={{
          width: '100%', maxWidth: 480,
          background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            {/* Mobile logo */}
            <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <span style={{ fontSize: 18, fontWeight: 700 }}>TTShelf</span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.3px' }}>Xoş gəldiniz</h1>
            <p style={{ color: 'var(--text-2)', marginBottom: 28, fontSize: 14 }}>Hesabınıza daxil olun</p>

            {error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 20,
                  color: '#dc2626', fontSize: 13, display: 'flex', gap: 8,
                }}>
                  <span>⚠</span> {error}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                  İstifadəçi adı və ya email
                </label>
                <input
                    type="text"
                    value={form.identifier}
                    onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                    autoFocus required autoComplete="username"
                    placeholder="username və ya email@example.com"
                    style={{
                      width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                      borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none',
                      transition: 'border-color .15s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Şifrə</label>
                <div style={{ position: 'relative' }}>
                  <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required autoComplete="current-password"
                      placeholder="••••••••"
                      style={{
                        width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0',
                        borderRadius: 10, padding: '10px 42px 10px 14px', fontSize: 14, outline: 'none',
                        transition: 'border-color .15s',
                      }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', background: loading ? '#a5b4fc' : 'var(--accent)',
                border: 'none', borderRadius: 10, padding: '11px 0', color: 'white',
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background .15s', marginTop: 4,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading && <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />}
                {loading ? 'Giriş edilir...' : 'Daxil ol'}
              </button>
            </form>

            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 13, marginTop: 24 }}>
              Hesabınız yoxdur?{' '}
              <a href="/register" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Qeydiyyat</a>
            </p>
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
  )
}