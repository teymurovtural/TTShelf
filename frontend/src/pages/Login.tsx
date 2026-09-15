import { useState } from 'react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function Login() {
  const setUser = useAuthStore((s) => s.setUser)
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(form)
      const { user, access_token } = res.data.data
      setUser(user, access_token)
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Xəta baş verdi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">TTShelf</h1>
          <p className="text-gray-400 mt-2">Kitab qeydlərinizə xoş gəldiniz</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-8 space-y-4">
          <h2 className="text-xl font-semibold text-white mb-6">Daxil ol</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Şifrə</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-3 transition-colors"
          >
            {loading ? 'Gözləyin...' : 'Daxil ol'}
          </button>

          <p className="text-center text-gray-400 text-sm">
            Hesabınız yoxdur?{' '}
            <a href="/register" className="text-blue-400 hover:text-blue-300">
              Qeydiyyat
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
