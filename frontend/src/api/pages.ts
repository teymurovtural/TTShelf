import client from './client'
import type {
    CanvasPage,
    CanvasElement,
    BatchElement,
    CreatePageRequest,
    UpdatePageRequest,
    ReorderPagesRequest,
} from '../types'

export const pagesApi = {
    // --- Pages ---
    getAll: (canvasId: string) =>
        client.get<{ success: boolean; data: CanvasPage[] }>(
            `/canvases/${canvasId}/pages`
        ),

    create: (canvasId: string, data: CreatePageRequest = {}) =>
        client.post<{ success: boolean; data: CanvasPage }>(
            `/canvases/${canvasId}/pages`,
            data
        ),

    update: (canvasId: string, pageId: string, data: UpdatePageRequest) =>
        client.put<{ success: boolean; data: CanvasPage }>(
            `/canvases/${canvasId}/pages/${pageId}`,
            data
        ),

    delete: (canvasId: string, pageId: string) =>
        client.delete(`/canvases/${canvasId}/pages/${pageId}`),

    reorder: (canvasId: string, data: ReorderPagesRequest) =>
        client.post(`/canvases/${canvasId}/pages/reorder`, data),

    // --- Page Elements ---
    getElements: (canvasId: string, pageId: string) =>
        client.get<{ success: boolean; data: CanvasElement[] }>(
            `/canvases/${canvasId}/pages/${pageId}/elements`
        ),

    batchSave: (canvasId: string, pageId: string, elements: BatchElement[]) =>
        client.post(
            `/canvases/${canvasId}/pages/${pageId}/elements/batch`,
            { elements }
        ),
}
