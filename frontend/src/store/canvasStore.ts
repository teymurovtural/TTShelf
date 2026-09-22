/* eslint-disable @typescript-eslint/no-unused-vars */
import { create } from 'zustand'
import type { CanvasElement, ElementType, ElementData } from '../types'

interface CanvasState {
    elements: CanvasElement[]
    selectedId: string | null
    selectedIds: string[]
    tool: ElementType | 'select' | 'pan' | 'eraser'
    isDirty: boolean
    eraserSize: number

    setElements: (elements: CanvasElement[]) => void
    setEraserSize: (size: number) => void
    addElement: (element: CanvasElement) => void
    updateElement: (id: string, data: Partial<ElementData>) => void
    updateElements: (ids: string[], data: Partial<ElementData>) => void
    // Elementin hansı page-ə aid olduğunu dəyişir — sürükləyib başqa A4-ün üstünə
    // qoyanda çağırılır ki, element vizual olaraq harda görünürsə ona da aid olsun
    setElementPageId: (id: string, pageId: string) => void
    deleteElement: (id: string) => void
    deleteSelected: () => void
    setSelectedId: (id: string | null) => void
    setSelectedIds: (ids: string[]) => void
    setTool: (tool: ElementType | 'select' | 'pan' | 'eraser') => void
    setDirty: (dirty: boolean) => void
    groupSelected: () => void
    ungroupSelected: () => void
    swapZIndex: (id1: string, id2: string) => void
    bringForward: (id: string) => void
    sendBackward: (id: string) => void
    bringToFront: (id: string) => void
    sendToBack: (id: string) => void

    history: CanvasElement[][]
    historyIndex: number
    pushHistory: () => void
    undo: () => void
    redo: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
    elements: [],
    selectedId: null,
    selectedIds: [],
    tool: 'select',
    isDirty: false,
    eraserSize: 20,
    history: [[]],
    historyIndex: 0,

    setEraserSize: (size) => set({ eraserSize: size }),

    setElements: (elements) => set({
        elements,
        isDirty: false,
        selectedId: null,
        selectedIds: [],
        history: [elements],
        historyIndex: 0,
    }),

    addElement: (element) => {
        get().pushHistory()
        set((state) => ({
            elements: [...state.elements, element],
            isDirty: true,
        }))
    },

    updateElement: (id, data) => {
        set((state) => ({
            elements: state.elements.map((el) =>
                el.id === id ? { ...el, data: { ...el.data, ...data } } : el
            ),
            isDirty: true,
        }))
    },

    updateElements: (ids, data) => {
        set((state) => ({
            elements: state.elements.map((el) =>
                ids.includes(el.id) ? { ...el, data: { ...el.data, ...data } } : el
            ),
            isDirty: true,
        }))
    },

    setElementPageId: (id, pageId) => {
        set((state) => ({
            elements: state.elements.map((el) =>
                el.id === id && el.page_id !== pageId ? { ...el, page_id: pageId } : el
            ),
            isDirty: true,
        }))
    },

    deleteElement: (id) => {
        get().pushHistory()
        set((state) => ({
            elements: state.elements.filter((el) => el.id !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
            selectedIds: state.selectedIds.filter((sid) => sid !== id),
            isDirty: true,
        }))
    },

    deleteSelected: () => {
        const { selectedIds, selectedId } = get()
        const toDelete = selectedIds.length > 0 ? selectedIds : (selectedId ? [selectedId] : [])
        if (toDelete.length === 0) return
        get().pushHistory()
        set((state) => ({
            elements: state.elements.filter((el) => !toDelete.includes(el.id)),
            selectedId: null,
            selectedIds: [],
            isDirty: true,
        }))
    },

    setSelectedId: (id) => set({
        selectedId: id,
        selectedIds: id ? [id] : [],
    }),

    setSelectedIds: (ids) => set({
        selectedIds: ids,
        selectedId: ids.length === 1 ? ids[0] : null,
    }),

    setTool: (tool) => set({ tool, selectedId: null, selectedIds: [] }),
    setDirty: (dirty) => set({ isDirty: dirty }),

    swapZIndex: (id1, id2) => {
        get().pushHistory()
        set((state) => ({
            elements: state.elements.map((el) => {
                if (el.id === id1) {
                    const z = state.elements.find((e) => e.id === id2)?.z_index ?? el.z_index
                    return { ...el, z_index: z }
                }
                if (el.id === id2) {
                    const z = state.elements.find((e) => e.id === id1)?.z_index ?? el.z_index
                    return { ...el, z_index: z }
                }
                return el
            }),
            isDirty: true,
        }))
    },

    bringForward: (id) => {
        const els = [...get().elements].sort((a, b) => a.z_index - b.z_index)
        const idx = els.findIndex((e) => e.id === id)
        if (idx < 0 || idx >= els.length - 1) return
        get().pushHistory()
        const tmp = els[idx].z_index
        els[idx] = { ...els[idx], z_index: els[idx + 1].z_index }
        els[idx + 1] = { ...els[idx + 1], z_index: tmp }
        set({ elements: els, isDirty: true })
    },

    sendBackward: (id) => {
        const els = [...get().elements].sort((a, b) => a.z_index - b.z_index)
        const idx = els.findIndex((e) => e.id === id)
        if (idx <= 0) return
        get().pushHistory()
        const tmp = els[idx].z_index
        els[idx] = { ...els[idx], z_index: els[idx - 1].z_index }
        els[idx - 1] = { ...els[idx - 1], z_index: tmp }
        set({ elements: els, isDirty: true })
    },

    bringToFront: (id) => {
        const els = [...get().elements].sort((a, b) => a.z_index - b.z_index)
        const idx = els.findIndex((e) => e.id === id)
        if (idx < 0 || idx >= els.length - 1) return
        get().pushHistory()
        const maxZ = els[els.length - 1].z_index + 1
        els[idx] = { ...els[idx], z_index: maxZ }
        set({ elements: els, isDirty: true })
    },

    sendToBack: (id) => {
        const els = [...get().elements].sort((a, b) => a.z_index - b.z_index)
        const idx = els.findIndex((e) => e.id === id)
        if (idx <= 0) return
        get().pushHistory()
        const minZ = els[0].z_index - 1
        els[idx] = { ...els[idx], z_index: minZ }
        set({ elements: els, isDirty: true })
    },

    groupSelected: () => {
        const { elements, selectedIds } = get()
        if (selectedIds.length < 2) return
        get().pushHistory()

        const selected = elements.filter((el) => selectedIds.includes(el.id))
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const el of selected) {
            const x = el.data.x ?? 0
            const y = el.data.y ?? 0
            const w = el.data.width ?? 0
            const h = el.data.height ?? 0
            const pts = el.data.points
            if (pts && pts.length >= 4) {
                for (let i = 0; i < pts.length; i += 2) {
                    minX = Math.min(minX, pts[i]);   maxX = Math.max(maxX, pts[i])
                    minY = Math.min(minY, pts[i+1]); maxY = Math.max(maxY, pts[i+1])
                }
            } else {
                minX = Math.min(minX, x);     maxX = Math.max(maxX, x + w)
                minY = Math.min(minY, y);     maxY = Math.max(maxY, y + h)
            }
        }

        const groupId = crypto.randomUUID()
        const updatedElements = elements.map((el) => {
            if (!selectedIds.includes(el.id)) return el
            return { ...el, data: { ...el.data, groupId, _gx: el.data.x, _gy: el.data.y } }
        })

        set({ elements: updatedElements, selectedIds, isDirty: true })
    },

    ungroupSelected: () => {
        const { elements, selectedIds } = get()
        if (selectedIds.length === 0) return

        const groupIds = new Set(
            elements
                .filter((el) => selectedIds.includes(el.id) && el.data.groupId)
                .map((el) => el.data.groupId as string)
        )
        if (groupIds.size === 0) return

        get().pushHistory()
        const updatedElements = elements.map((el) => {
            if (!el.data.groupId || !groupIds.has(el.data.groupId)) return el
            // ElementData [key: string]: any olduğundan destructure işləyir
            const { groupId: _g, _gx: _gx2, _gy: _gy2, ...restData } = el.data
            return { ...el, data: restData }
        })

        set({ elements: updatedElements, isDirty: true })
    },

    pushHistory: () => {
        const { elements, history, historyIndex } = get()
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(elements.map((el) => ({ ...el, data: { ...el.data } })))
        if (newHistory.length > 51) newHistory.splice(0, newHistory.length - 51)
        set({ history: newHistory, historyIndex: newHistory.length - 1 })
    },

    undo: () => {
        const { historyIndex, history } = get()
        if (historyIndex <= 0) return
        const newIndex = historyIndex - 1
        set({
            elements: history[newIndex].map((el) => ({ ...el, data: { ...el.data } })),
            historyIndex: newIndex,
            selectedId: null,
            selectedIds: [],
            isDirty: true,
        })
    },

    redo: () => {
        const { historyIndex, history } = get()
        if (historyIndex >= history.length - 1) return
        const newIndex = historyIndex + 1
        set({
            elements: history[newIndex].map((el) => ({ ...el, data: { ...el.data } })),
            historyIndex: newIndex,
            selectedId: null,
            selectedIds: [],
            isDirty: true,
        })
    },
}))