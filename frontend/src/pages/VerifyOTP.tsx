import { useState, useRef, useEffect } from 'react'
import { BookOpen, Mail, RefreshCw } from 'lucide-react'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'

export default function VerifyOTP() {
  const setUser = useAuthStore((s) => s.setUser)
  const params  = new URLSearchParams(window.location.search)
  const email   = params.get('email') || ''

  const [otp,            setOtp]            = useState(['', '', '', '', '', ''])
  const [error,          setError]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading,  setResendLoading]  = useState(false)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((v) => v - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const handleChange = (index: number, value: string) => {
    const digit  = value.replace(/\D/g, '').slice(-1)
    const newOtp = [...otp]
    newOtp[index] = digit
    setOtp(newOtp)
    setError('')
    if (digit && index < 5) inputRefs.current[index + 1]?.focus()
    if (newOtp.every((d) => d !== '') && digit) submitOtp(newOtp.join(''))
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const n = [...otp]; n[index - 1] = ''; setOtp(n)
        inputRefs.current[index - 1]?.focus()
      } else {
        const n = [...otp]; n[index] = ''; setOtp(n)
      }
    }
    if (e.key === 'ArrowLeft'  && index > 0) inputRefs.current[index - 1]?.focus()
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text   = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const newOtp = [...otp]
    text.split('').forEach((d, i) => { if (i < 6) newOtp[i] = d })
    setOtp(newOtp)
    inputRefs.current[Math.min(text.length, 5)]?.focus()
    if (newOtp.every((d) => d !== '')) submitOtp(newOtp.join(''))
  }

  const submitOtp = async (code: string) => {
    if (!email) { setError('Email tapılmadı. Qeydiyyat səhifəsinə qayıdın.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await authApi.verifyOtp({ email, otp: code })
      const { user, access_token } = res.data.data
      setUser(user, access_token)
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Kod yanlışdır')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) { setError('6 rəqəmli kodu tam daxil edin'); return }
    submitOtp(code)
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return
    setResendLoading(true)
    try {
      await authApi.resendOtp(email)
      setResendCooldown(60)
      setError('')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch (err: any) {
      const code = err.response?.data?.error?.code
      if (code === 'TOO_MANY_REQUESTS') setResendCooldown(60)
      else setError(err.response?.data?.error?.message || 'Xəta baş verdi')
    } finally {
      setResendLoading(false)
    }
  }

  const maskedEmail = email
    ? email.replace(/(.{2}).+(@.+)/, '$1***$2')
    : '***'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-600 rounded-xl mb-4">
            <BookOpen size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">TTShelf</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Mail size={28} className="text-indigo-600" />
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 text-center mb-2">Email-i təsdiq et</h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            <span className="font-medium text-gray-700">{maskedEmail}</span> ünvanına<br />
            6 rəqəmli kod göndərdik
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none transition-all
                    ${digit
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 bg-gray-50 text-gray-900'
                    } focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100`}
                  disabled={loading}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otp.some((d) => !d)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed
                         text-white font-medium rounded-xl py-3 text-sm transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Yoxlanılır...
                </span>
              ) : 'Təsdiqlə'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <span className="text-gray-500 text-sm">Kod gəlmədi? </span>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resendLoading}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:text-gray-400
                         disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              {resendLoading && <RefreshCw size={13} className="animate-spin" />}
              {resendCooldown > 0 ? `Yenidən göndər (${resendCooldown}s)` : 'Yenidən göndər'}
            </button>
          </div>

          <div className="mt-4 text-center">
            <a href="/register" className="text-gray-400 text-xs hover:text-gray-600">
              ← Qeydiyyata qayıt
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
