import { create } from 'zustand'
import type { CanvasElement, CanvasPage } from '../types'
import { pagesApi } from '../api/pages'
import { useCanvasStore } from './canvasStore'

interface PageState {
    pages: CanvasPage[]
    activePageId: string | null
    loading: boolean

    setPages: (pages: CanvasPage[]) => void
    setActivePageId: (id: string | null) => void
    addPage: (page: CanvasPage) => void
    updatePage: (id: string, patch: Partial<CanvasPage>) => void
    removePage: (id: string) => void
    reorderPages: (ids: string[]) => void
    movePagePosition: (id: string, x: number, y: number) => void

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

    movePagePosition: (id, x, y) =>
        set((state) => ({
            pages: state.pages.map((p) => p.id === id ? { ...p, x, y } : p),
        })),

    loadPages: async (canvasId) => {
        set({ loading: true })
        try {
            const res = await pagesApi.getAll(canvasId)
            const pages: CanvasPage[] = res.data.data || []
            set({ pages })

            if (pages.length === 0) return

            const results = await Promise.all(
                pages.map((p) => pagesApi.getElements(canvasId, p.id))
            )

            const allElements: CanvasElement[] = []
            results.forEach((r, i) => {
                const els: CanvasElement[] = r.data.data || []
                els.forEach(el => {
                    allElements.push({ ...el, page_id: pages[i].id })
                })
            })

            useCanvasStore.getState().setElements(allElements)
            set({ activePageId: pages[0].id })
        } catch (err) {
            console.error('Page-lər yüklənmədi:', err)
        } finally {
            set({ loading: false })
        }
    },

    switchPage: async (canvasId, pageId) => {
        const { activePageId } = get()
        if (activePageId === pageId) return

        if (activePageId) {
            const { elements, isDirty } = useCanvasStore.getState()
            const pageEls = elements.filter(el => el.page_id === activePageId)
            if (isDirty && pageEls.length >= 0) {
                try {
                    const batch = pageEls.map((el, idx) => ({
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

        set({ activePageId: pageId })
    },

    createPage: async (canvasId, title, orientation = 'portrait') => {
        const pageNum = get().pages.length + 1
        const res = await pagesApi.create(canvasId, {
            title: title || `Səhifə ${pageNum}`,
            orientation,
        })
        const page = res.data.data
        get().addPage(page)
        await get().switchPage(canvasId, page.id)
        return page
    },

    deletePage: async (canvasId, pageId) => {
        await pagesApi.delete(canvasId, pageId)

        const { elements } = useCanvasStore.getState()
        useCanvasStore.getState().setElements(
            elements.filter(el => el.page_id !== pageId)
        )

        get().removePage(pageId)

        if (get().activePageId === pageId) {
            const remaining = get().pages
            if (remaining.length > 0) {
                await get().switchPage(canvasId, remaining[0].id)
            }
        }
    },
}))