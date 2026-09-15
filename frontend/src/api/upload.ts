import client from './client'
import type { UploadResponse, Font } from '../types'

export const uploadApi = {
    image: (file: File) => {
        const formData = new FormData()
        formData.append('file', file)
        return client.post<{ success: boolean; data: UploadResponse }>('/upload/image', formData)
    },
}

export const fontsApi = {
    getAll: () =>
        client.get<{ success: boolean; data: Font[] }>('/fonts'),

    upload: (file: File, name: string) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('name', name)
        return client.post<{ success: boolean; data: Font }>('/fonts', formData)
    },

    delete: (id: string) =>
        client.delete(`/fonts/${id}`),
}