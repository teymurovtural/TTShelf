import client from './client'
import type { Canvas, CanvasListResponse, CanvasElement, BatchElement, ExportPDFResponse } from '../types'

export const canvasApi = {
    getAll: (limit = 20, offset = 0) =>
        client.get<{ success: boolean; data: CanvasListResponse }>('/canvases', {
            params: { limit, offset },
        }),

    getById: (id: string) =>
        client.get<{ success: boolean; data: Canvas }>(`/canvases/${id}`),

    create: (data: { title?: string; book_id?: string }) =>
        client.post<{ success: boolean; data: Canvas }>('/canvases', data),

    updateTitle: (id: string, title: string) =>
        client.put<{ success: boolean; data: Canvas }>(`/canvases/${id}`, { title }),

    delete: (id: string) =>
        client.delete(`/canvases/${id}`),

    // Elements
    getElements: (canvasId: string) =>
        client.get<{ success: boolean; data: CanvasElement[] }>(`/canvases/${canvasId}/elements`),

    batchSave: (canvasId: string, elements: BatchElement[]) =>
        client.post(`/canvases/${canvasId}/elements/batch`, { elements }),

    // Export
    exportPdf: (canvasId: string, pdfBlob: Blob) => {
        const formData = new FormData()
        formData.append('file', pdfBlob, 'export.pdf')
        return client.post<{ success: boolean; data: ExportPDFResponse }>(
            `/canvases/${canvasId}/export/pdf`,
            formData
        )
    },
}