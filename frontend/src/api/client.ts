import axios from 'axios'

const client = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    withCredentials: true, // refresh token cookie üçün
})

// Request interceptor — access token əlavə et
client.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Response interceptor — 401-də token refresh et
client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config

        if (error.response?.status === 401 && !original._retry) {
            original._retry = true

            try {
                const res = await axios.post(
                    `${import.meta.env.VITE_API_URL || '/api/v1'}/auth/refresh`,
                    {},
                    { withCredentials: true }
                )
                const newToken = res.data.data.access_token
                localStorage.setItem('access_token', newToken)
                original.headers.Authorization = `Bearer ${newToken}`
                return client(original)
            } catch {
                localStorage.removeItem('access_token')
                window.location.href = '/login'
            }
        }

        return Promise.reject(error)
    }
)

export default client