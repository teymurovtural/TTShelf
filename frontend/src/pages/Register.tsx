import { useState } from 'react'
import { Eye, EyeOff, BookOpen, Check, X } from 'lucide-react'
import { authApi } from '../api/auth'

interface FieldError { email?: string; username?: string; name?: string; password?: string }

function validate(f: { email: string; username: string; name: string; password: string }): FieldError {
  const e: FieldError = {}
  if (!f.email) e.email = 'Email tələb olunur'
  else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(f.email))
    e.email = 'Email formatı düzgün deyil'
  if (!f.username) e.username = 'Username tələb olunur'
  else if (!/^[a-zA-Z0-9_]{3,30}$/.test(f.username))
    e.username = 'Yalnız hərf, rəqəm, alt xətt (3-30 simvol)'
  if (!f.name) e.name = 'Ad tələb olunur'
  else if (f.name.trim().length < 2) e.name = 'Ad minimum 2 simvol olmalıdır'
  if (!f.password) e.password = 'Şifrə tələb olunur'
  else if (f.password.length < 8) e.password = 'Minimum 8 simvol olmalıdır'
  return e
}

const passwordRules = [
  { label: 'Minimum 8 simvol',  test: (p: string) => p.length >= 8 },
  { label: 'Böyük hərf (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Rəqəm (0-9)',       test: (p: string) => /[0-9]/.test(p) },
]

export default function Register() {
  const [form,         setForm]         = useState({ email: '', username: '', name: '', password: '' })
  const [fieldErrors,  setFieldErrors]  = useState<FieldError>({})
  const [showPassword, setShowPassword] = useState(false)
  const [serverError,  setServerError]  = useState('')
  const [loading,      setLoading]      = useState(false)
  const [touched,      setTouched]      = useState<Record<string, boolean>>({})

  const handleBlur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }))
    setFieldErrors(validate(form))
  }

  const handleChange = (field: string, value: string) => {
    const updated = { ...form, [field]: value }
    setForm(updated)
    if (touched[field]) setFieldErrors(validate(updated))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ email: true, username: true, name: true, password: true })
    const errs = validate(form)
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setServerError('')
    setLoading(true)
    try {
      await authApi.register({
        ...form,
        email:    form.email.toLowerCase().trim(),
        username: form.username.trim(),
        name:     form.name.trim(),
      })
      window.location.href = `/verify-otp?email=${encodeURIComponent(form.email.toLowerCase().trim())}`
    } catch (err: any) {
      setServerError(err.response?.data?.error?.message || 'Xəta baş verdi')
    } finally {
      setLoading(false)
    }
  }

  const inputClass = (field: keyof FieldError) =>
    `w-full bg-gray-50 border text-gray-900 rounded-xl px-4 py-3 text-sm outline-none transition-all placeholder:text-gray-400 focus:ring-2 ${
      touched[field] && fieldErrors[field]
        ? 'border-red-300 focus:border-red-400 focus:ring-red-100'
        : 'border-gray-200 focus:border-indigo-500 focus:ring-indigo-100'
    }`

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <BookOpen size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TTShelf</h1>
          <p className="text-gray-500 mt-1 text-sm">Yeni hesab yarat</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Qeydiyyat</h2>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ad Soyad</label>
              <input type="text" value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                onBlur={() => handleBlur('name')}
                className={inputClass('name')} placeholder="Tural Teymurov" autoFocus />
              {touched.name && fieldErrors.name && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">@</span>
                <input type="text" value={form.username}
                  onChange={(e) => handleChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  onBlur={() => handleBlur('username')}
                  className={`${inputClass('username')} pl-8`}
                  placeholder="tural_dev" autoComplete="username" />
              </div>
              {touched.username && fieldErrors.username && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                className={inputClass('email')} placeholder="email@example.com" autoComplete="email" />
              {touched.email && fieldErrors.email && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifrə</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  className={`${inputClass('password')} pr-11`}
                  placeholder="••••••••" autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2 space-y-1">
                  {passwordRules.map((rule) => {
                    const ok = rule.test(form.password)
                    return (
                      <div key={rule.label} className={`flex items-center gap-1.5 text-xs ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                        {ok ? <Check size={12} /> : <X size={12} />}
                        {rule.label}
                      </div>
                    )
                  })}
                </div>
              )}
              {touched.password && fieldErrors.password && !form.password && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>
              )}
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-medium rounded-xl py-3 text-sm transition-colors mt-2">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Qeydiyyat edilir...
                </span>
              ) : 'Qeydiyyatdan keç'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Hesabınız var?{' '}
            <a href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">Daxil ol</a>
          </p>
        </div>
      </div>
    </div>
  )
}
