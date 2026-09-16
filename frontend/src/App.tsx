import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Login     from './pages/Login'
import Register  from './pages/Register'
import VerifyOTP from './pages/VerifyOTP'
import Dashboard from './pages/Dashboard'
import Editor    from './pages/Editor'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"           element={<Navigate to="/dashboard" replace />} />
        <Route path="/login"      element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register"   element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/dashboard"  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/editor/:id" element={<PrivateRoute><Editor /></PrivateRoute>} />
        <Route path="*"           element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
