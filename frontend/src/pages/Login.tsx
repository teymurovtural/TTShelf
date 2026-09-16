import { useState } from 'react'
import { Eye, EyeOff, BookOpen } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const setUser = useAuthStore((s) => s.setUser)
  const [form,         setForm]         = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <BookOpen size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TTShelf</h1>
          <p className="text-gray-500 mt-1 text-sm">Kitab qeydlərini idarə et</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Daxil ol</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-start gap-2">
              <span className="mt-0.5">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                İstifadəçi adı və ya email
              </label>
              <input
                type="text"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm outline-none
                           focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-gray-400"
                placeholder="username və ya email@example.com"
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifrə</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 pr-11 text-sm outline-none
                             focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-gray-400"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-medium rounded-xl py-3 text-sm transition-colors mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Giriş edilir...
                </span>
              ) : 'Daxil ol'}
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Hesabınız yoxdur?{' '}
            <a href="/register" className="text-indigo-600 hover:text-indigo-700 font-medium">Qeydiyyat</a>
          </p>
        </div>
      </div>
    </div>
  )
}
