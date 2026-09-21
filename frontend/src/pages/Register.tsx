import { useState } from 'react'
import { Eye, EyeOff, Check, X } from 'lucide-react'
import { authApi } from '../api/auth'

interface FieldError { email?: string; username?: string; name?: string; password?: string }

function validate(f: { email: string; username: string; name: string; password: string }): FieldError {
  const e: FieldError = {}
  if (!f.email) e.email = 'Email tələb olunur'
  else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(f.email)) e.email = 'Email formatı düzgün deyil'
  if (!f.username) e.username = 'Username tələb olunur'
  else if (!/^[a-zA-Z0-9_]{3,30}$/.test(f.username)) e.username = 'Yalnız hərf, rəqəm, alt xətt (3-30 simvol)'
  if (!f.name) e.name = 'Ad tələb olunur'
  else if (f.name.trim().length < 2) e.name = 'Ad minimum 2 simvol olmalıdır'
  if (!f.password) e.password = 'Şifrə tələb olunur'
  else if (f.password.length < 8) e.password = 'Minimum 8 simvol olmalıdır'
  return e
}

const passwordRules = [
  { label: 'Minimum 8 simvol',  test: (p: string) => p.length >= 8 },
  { label: 'Böyük hərf (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Rəqəm (0-9)',      test: (p: string) => /[0-9]/.test(p) },
]

export default function Register() {
  const [form, setForm] = useState({ email: '', username: '', name: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<FieldError>({})
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState('')
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const handleBlur = (field: string) => {
    setTouched(p => ({ ...p, [field]: true }))
    setFieldErrors(validate(form))
  }
  const handleChange = (field: string, value: string) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    if (touched[field]) setFieldErrors(validate(updated))
  }
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setTouched({ email: true, username: true, name: true, password: true })
    const errs = validate(form)
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return
    setServerError('')
    setLoading(true)
    try {
      await authApi.register({ ...form, email: form.email.toLowerCase().trim(), username: form.username.trim(), name: form.name.trim() })
      window.location.href = `/verify-otp?email=${encodeURIComponent(form.email.toLowerCase().trim())}`
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
      setServerError(msg || 'Xəta baş verdi')
    } finally { setLoading(false) }
  }

  const inputStyle = (field: keyof FieldError): React.CSSProperties => ({
    width: '100%', background: '#f8fafc',
    border: `1.5px solid ${touched[field] && fieldErrors[field] ? '#fca5a5' : '#e2e8f0'}`,
    borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', transition: 'border-color .15s',
  })

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)'
  }
  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#e2e8f0'
  }

  return (
      <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex' }}>
        {/* Left */}
        <div style={{ flex: 1, background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 48 }} className="hidden md:flex">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <span style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>TTShelf</span>
          </div>
          <h2 style={{ color: 'white', fontSize: 30, fontWeight: 700, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.5px' }}>
            Biliklərinizi<br />strukturlaşdırın
          </h2>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.7, maxWidth: 300 }}>
            Kitab oxuyarkən fikirlərini canvas üzərindəçək, şəkillər əlavə et, PDF kimi saxla.
          </p>
        </div>

        {/* Right */}
        <div style={{ width: '100%', maxWidth: 480, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ width: '100%', maxWidth: 360 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 6, letterSpacing: '-0.3px' }}>Hesab yarat</h1>
            <p style={{ color: 'var(--text-2)', marginBottom: 28, fontSize: 14 }}>Pulsuz qeydiyyatdan keçin</p>

            {serverError && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: 13, display: 'flex', gap: 8 }}>
                  <span>⚠</span> {serverError}
                </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Ad Soyad</label>
                <input
                    type="text" value={form.name} autoFocus
                    onChange={e => handleChange('name', e.target.value)}
                    onBlur={() => handleBlur('name')}
                    onFocus={handleFocus}
                    placeholder="Tural Teymurov"
                    style={inputStyle('name')}
                />
                {touched.name && fieldErrors.name && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{fieldErrors.name}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 14 }}>@</span>
                  <input
                      type="text" value={form.username} autoComplete="username"
                      onChange={e => handleChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      onBlur={() => handleBlur('username')}
                      onFocus={handleFocus}
                      placeholder="tural_dev"
                      style={{ ...inputStyle('username'), paddingLeft: 28 }}
                  />
                </div>
                {touched.username && fieldErrors.username && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{fieldErrors.username}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Email</label>
                <input
                    type="email" value={form.email} autoComplete="email"
                    onChange={e => handleChange('email', e.target.value)}
                    onBlur={() => { handleBlur('email'); handleInputBlur({ target: { style: { borderColor: '' } } } as React.FocusEvent<HTMLInputElement>) }}
                    onFocus={handleFocus}
                    placeholder="email@example.com"
                    style={inputStyle('email')}
                />
                {touched.email && fieldErrors.email && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{fieldErrors.email}</p>}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Şifrə</label>
                <div style={{ position: 'relative' }}>
                  <input
                      type={showPassword ? 'text' : 'password'} value={form.password} autoComplete="new-password"
                      onChange={e => handleChange('password', e.target.value)}
                      onBlur={() => handleBlur('password')}
                      placeholder="••••••••"
                      style={{ ...inputStyle('password'), paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {form.password && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {passwordRules.map(rule => {
                        const ok = rule.test(form.password)
                        return (
                            <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: ok ? '#10b981' : '#94a3b8' }}>
                              {ok ? <Check size={11} /> : <X size={11} />} {rule.label}
                            </div>
                        )
                      })}
                    </div>
                )}
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', background: loading ? '#a5b4fc' : 'var(--accent)',
                border: 'none', borderRadius: 10, padding: '11px 0', color: 'white',
                fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {loading && <span style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />}
                {loading ? 'Qeydiyyat edilir...' : 'Qeydiyyatdan keç'}
              </button>
            </form>

            <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 13, marginTop: 24 }}>
              Hesabınız var?{' '}
              <a href="/login" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Daxil ol</a>
            </p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
  )
}