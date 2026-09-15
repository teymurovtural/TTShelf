import { create } from 'zustand'
import type { User } from '../types'

interface AuthState {
    user: User | null
    isAuthenticated: boolean
    setUser: (user: User, token: string) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: !!localStorage.getItem('access_token'),

    setUser: (user, token) => {
        localStorage.setItem('access_token', token)
        set({ user, isAuthenticated: true })
    },

    logout: () => {
        localStorage.removeItem('access_token')
        set({ user: null, isAuthenticated: false })
    },
}))