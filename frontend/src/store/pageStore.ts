import { create } from 'zustand'
import type { CanvasElement, CanvasPage } from '../types'
import { pagesApi } from '../api/pages'
import { useCanvasStore } from './canvasStore'

interface PageState {
    pages: CanvasPage[]
    activePageId: string | null
    loading: boolean
    // Bütün page-lərin elementləri — pageId → elements[]
    allPageElements: Record<string, CanvasElement[]>

    // Actions
    setPages: (pages: CanvasPage[]) => void
    setActivePageId: (id: string) => void
    addPage: (page: CanvasPage) => void
    updatePage: (id: string, patch: Partial<CanvasPage>) => void
    removePage: (id: string) => void
    reorderPages: (ids: string[]) => void
    setPageElements: (pageId: string, elements: CanvasElement[]) => void

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
    allPageElements: {},

    setPages: (pages) => set({ pages }),
    setActivePageId: (id) => set({ activePageId: id }),

    setPageElements: (pageId, elements) =>
        set((state) => ({
            allPageElements: { ...state.allPageElements, [pageId]: elements },
        })),

    addPage: (page) =>
        set((state) => ({
            pages: [...state.pages, page].sort((a, b) => a.page_number - b.page_number),
        })),

    updatePage: (id, patch) =>
        set((state) => ({
            pages: state.pages.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

    removePage: (id) =>
        set((state) => {
            const { [id]: _, ...rest } = state.allPageElements
            return {
                pages: state.pages.filter((p) => p.id !== id),
                allPageElements: rest,
            }
        }),

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

    // Bütün page-ləri və hamısının elementlərini yüklə
    loadPages: async (canvasId) => {
        set({ loading: true })
        try {
            const res = await pagesApi.getAll(canvasId)
            const pages: CanvasPage[] = res.data.data || []
            set({ pages })

            if (pages.length === 0) return

            // Bütün page-lərin elementlərini paralel yüklə
            const results = await Promise.all(
                pages.map((p) => pagesApi.getElements(canvasId, p.id))
            )

            const allPageElements: Record<string, CanvasElement[]> = {}
            results.forEach((r, i) => {
                allPageElements[pages[i].id] = r.data.data || []
            })

            set({ allPageElements, activePageId: pages[0].id })

            // Aktiv page-in elementlərini canvasStore-a set et
            useCanvasStore.getState().setElements(allPageElements[pages[0].id])
        } catch (err) {
            console.error('Page-lər yüklənmədi:', err)
        } finally {
            set({ loading: false })
        }
    },

    // Page dəyiş — əvvəlki page-i save et, yenisini aktiv et
    switchPage: async (canvasId, pageId) => {
        const { activePageId, allPageElements } = get()
        if (activePageId === pageId) return

        // Əvvəlki page-in elementlərini cache-ə yaz + backend-ə save et
        if (activePageId) {
            const { elements, isDirty } = useCanvasStore.getState()
            // Cache-ı güncəllə
            set((state) => ({
                allPageElements: { ...state.allPageElements, [activePageId]: elements },
            }))
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

        set({ activePageId: pageId })

        // Cache-da varsa birbaşa istifadə et, yoxdursa backend-dən yüklə
        if (allPageElements[pageId]) {
            useCanvasStore.getState().setElements(allPageElements[pageId])
        } else {
            try {
                const elRes = await pagesApi.getElements(canvasId, pageId)
                const els = elRes.data.data || []
                set((state) => ({
                    allPageElements: { ...state.allPageElements, [pageId]: els },
                }))
                useCanvasStore.getState().setElements(els)
            } catch (err) {
                console.error('Page elementləri yüklənmədi:', err)
            }
        }
    },

    createPage: async (canvasId, title, orientation = 'portrait') => {
        const pageNum = get().pages.length + 1
        const res = await pagesApi.create(canvasId, {
            title: title || `Səhifə ${pageNum}`,
            orientation,
        })
        const page = res.data.data
        get().addPage(page)
        // Yeni page üçün boş element cache-i yarat
        set((state) => ({
            allPageElements: { ...state.allPageElements, [page.id]: [] },
        }))
        return page
    },

    deletePage: async (canvasId, pageId) => {
        await pagesApi.delete(canvasId, pageId)
        get().removePage(pageId)

        if (get().activePageId === pageId) {
            const remaining = get().pages
            if (remaining.length > 0) {
                await get().switchPage(canvasId, remaining[0].id)
            }
        }
    },
}))