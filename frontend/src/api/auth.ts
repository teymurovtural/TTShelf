import client from './client'
import type { AuthResponse } from '../types'

export const authApi = {
    register: (data: { email: string; username: string; name: string; password: string }) =>
        client.post<{ success: boolean; data: AuthResponse }>('/auth/register', data),

    login: (data: { email: string; password: string }) =>
        client.post<{ success: boolean; data: AuthResponse }>('/auth/login', data),

    logout: () =>
        client.delete('/auth/logout'),
}