import { useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'

export function useKeyboard() {
  const { undo, redo, deleteSelected, groupSelected, ungroupSelected } = useCanvasStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' || e.key === 'Z') {
          e.preventDefault()
          if (e.shiftKey) redo()
          else undo()
        }
        if (e.key === 'y') {
          e.preventDefault()
          redo()
        }
        if (e.key === 'g') {
          e.preventDefault()
          if (e.shiftKey) ungroupSelected()
          else groupSelected()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, deleteSelected, groupSelected, ungroupSelected])
}
