import { create } from 'zustand'
import type { CanvasElement, ElementType, ElementData } from '../types'

interface CanvasState {
    elements: CanvasElement[]
    selectedId: string | null
    tool: ElementType | 'select' | 'pan'
    isDirty: boolean  // dəyişiklik var, save lazımdır

    // Actions
    setElements: (elements: CanvasElement[]) => void
    addElement: (element: CanvasElement) => void
    updateElement: (id: string, data: Partial<ElementData>) => void
    deleteElement: (id: string) => void
    setSelectedId: (id: string | null) => void
    setTool: (tool: ElementType | 'select' | 'pan') => void
    setDirty: (dirty: boolean) => void

    // Undo/Redo
    history: CanvasElement[][]
    historyIndex: number
    pushHistory: () => void
    undo: () => void
    redo: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
    elements: [],
    selectedId: null,
    tool: 'select',
    isDirty: false,
    history: [[]],
    historyIndex: 0,

    setElements: (elements) => set({ elements, isDirty: false }),

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

    deleteElement: (id) => {
        get().pushHistory()
        set((state) => ({
            elements: state.elements.filter((el) => el.id !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
            isDirty: true,
        }))
    },

    setSelectedId: (id) => set({ selectedId: id }),
    setTool: (tool) => set({ tool, selectedId: null }),
    setDirty: (dirty) => set({ isDirty: dirty }),

    pushHistory: () => {
        const { elements, history, historyIndex } = get()
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push([...elements])
        set({ history: newHistory, historyIndex: newHistory.length - 1 })
    },

    undo: () => {
        const { historyIndex, history } = get()
        if (historyIndex <= 0) return
        const newIndex = historyIndex - 1
        set({
            elements: [...history[newIndex]],
            historyIndex: newIndex,
            isDirty: true,
        })
    },

    redo: () => {
        const { historyIndex, history } = get()
        if (historyIndex >= history.length - 1) return
        const newIndex = historyIndex + 1
        set({
            elements: [...history[newIndex]],
            historyIndex: newIndex,
            isDirty: true,
        })
    },
}))