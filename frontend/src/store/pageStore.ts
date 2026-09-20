import { create } from 'zustand'
import type { CanvasPage } from '../types'
import { pagesApi } from '../api/pages'
import { useCanvasStore } from './canvasStore'

interface PageState {
    pages: CanvasPage[]
    activePageId: string | null
    loading: boolean

    // Actions
    setPages: (pages: CanvasPage[]) => void
    setActivePageId: (id: string) => void
    addPage: (page: CanvasPage) => void
    updatePage: (id: string, patch: Partial<CanvasPage>) => void
    removePage: (id: string) => void
    reorderPages: (ids: string[]) => void

    // Thunks
    loadPages: (canvasId: string) => Promise<void>
    switchPage: (canvasId: string, pageId: string) => Promise<void>
    createPage: (canvasId: string, title?: string, orientation?: 'portrait' | 'landscape') => Promise<CanvasPage>
    deletePage: (canvasId: string, pageId: string) => Promise<void>
}

export const usePageStore = create<PageState>((set, get) => ({
    pages: [],
    activePageId: null,
    loading: false,

    setPages: (pages) => set({ pages }),

    setActivePageId: (id) => set({ activePageId: id }),

    addPage: (page) =>
        set((state) => ({
            pages: [...state.pages, page].sort((a, b) => a.page_number - b.page_number),
        })),

    updatePage: (id, patch) =>
        set((state) => ({
            pages: state.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

    removePage: (id) =>
        set((state) => ({
            pages: state.pages.filter((p) => p.id !== id),
        })),

    reorderPages: (ids) =>
        set((state) => {
            const map = new Map(state.pages.map((p) => [p.id, p]))
            const reordered = ids
                .map((id, i) => {
                    const p = map.get(id)
                    return p ? { ...p, page_number: i + 1 } : null
                })
                .filter(Boolean) as CanvasPage[]
            return { pages: reordered }
        }),

    // Bütün page-ləri yüklə, birincisini aktiv et
    loadPages: async (canvasId) => {
        set({ loading: true })
        try {
            const res = await pagesApi.getAll(canvasId)
            const pages = res.data.data || []
            set({ pages })

            if (pages.length > 0) {
                const firstId = pages[0].id
                set({ activePageId: firstId })
                const elRes = await pagesApi.getElements(canvasId, firstId)
                useCanvasStore.getState().setElements(elRes.data.data || [])
            }
        } catch (err) {
            console.error('Page-lər yüklənmədi:', err)
        } finally {
            set({ loading: false })
        }
    },

    // Page dəyiş — əvvəlki page-i save et, yenisini yüklə
    switchPage: async (canvasId, pageId) => {
        const { activePageId } = get()
        if (activePageId === pageId) return

        // Əvvəlki page-i save et
        if (activePageId) {
            const { elements, isDirty } = useCanvasStore.getState()
            if (isDirty) {
                try {
                    const batch = elements.map((el, idx) => ({
                        id: el.id,
                        type: el.type,
                        data: el.data,
                        z_index: idx,
                    }))
                    await pagesApi.batchSave(canvasId, activePageId, batch)
                    useCanvasStore.getState().setDirty(false)
                } catch (err) {
                    console.error('Page save xətası:', err)
                }
            }
        }

        // Yeni page-i yüklə
        set({ activePageId: pageId })
        try {
            const elRes = await pagesApi.getElements(canvasId, pageId)
            useCanvasStore.getState().setElements(elRes.data.data || [])
        } catch (err) {
            console.error('Page elementləri yüklənmədi:', err)
        }
    },

    // Yeni page yarat — aktiv page dəyişmir, sadəcə siyahıya əlavə olunur
    createPage: async (canvasId, title, orientation = 'portrait') => {
        const pageNum = get().pages.length + 1
        const res = await pagesApi.create(canvasId, {
            title: title || `Səhifə ${pageNum}`,
            orientation,
        })
        const page = res.data.data
        get().addPage(page)
        // switchPage çağırılmır — aktiv page qalır
        return page
    },

    deletePage: async (canvasId, pageId) => {
        await pagesApi.delete(canvasId, pageId)
        get().removePage(pageId)

        // Silinen page aktivdirsə başqasına keç
        if (get().activePageId === pageId) {
            const remaining = get().pages
            if (remaining.length > 0) {
                await get().switchPage(canvasId, remaining[0].id)
            }
        }
    },
}))