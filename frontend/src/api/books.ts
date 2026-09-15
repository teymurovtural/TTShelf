import client from './client'
import type { Book, BooksListResponse, Annotation } from '../types'

export const booksApi = {
    getAll: (limit = 20, offset = 0) =>
        client.get<{ success: boolean; data: BooksListResponse }>('/books', {
            params: { limit, offset },
        }),

    getById: (id: string) =>
        client.get<{ success: boolean; data: Book }>(`/books/${id}`),

    upload: (formData: FormData) =>
        client.post<{ success: boolean; data: Book }>('/books', formData),

    delete: (id: string) =>
        client.delete(`/books/${id}`),

    getFileUrl: (id: string) =>
        `${import.meta.env.VITE_API_URL || '/api/v1'}/books/${id}/file`,

    updateBookmark: (id: string, lastPage: number) =>
        client.put(`/books/${id}/bookmark`, { last_page: lastPage }),

    // Annotations
    getAnnotations: (bookId: string) =>
        client.get<{ success: boolean; data: Annotation[] }>(`/books/${bookId}/annotations`),

    createAnnotation: (bookId: string, data: Omit<Annotation, 'id' | 'book_id' | 'user_id' | 'created_at'>) =>
        client.post<{ success: boolean; data: Annotation }>(`/books/${bookId}/annotations`, data),

    deleteAnnotation: (bookId: string, annotationId: string) =>
        client.delete(`/books/${bookId}/annotations/${annotationId}`),
}