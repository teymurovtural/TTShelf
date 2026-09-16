import client from './client'
import type { AuthResponse } from '../types'

export interface RegisterResponse {
  email:   string
  message: string
}

export const authApi = {
  register: (data: { email: string; username: string; name: string; password: string }) =>
    client.post<{ success: boolean; data: RegisterResponse }>('/auth/register', data),

  verifyOtp: (data: { email: string; otp: string }) =>
    client.post<{ success: boolean; data: AuthResponse }>('/auth/verify-otp', data),

  resendOtp: (email: string) =>
    client.post<{ success: boolean; data: { message: string } }>('/auth/resend-otp', { email }),

  // identifier: username və ya email
  login: (data: { identifier: string; password: string }) =>
    client.post<{ success: boolean; data: AuthResponse }>('/auth/login', data),

  logout: () =>
    client.delete('/auth/logout'),
}
