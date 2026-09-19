import { useEffect } from 'react'
import { useCanvasStore } from '../store/canvasStore'

export function useKeyboard() {
  const { undo, redo, deleteSelected, groupSelected, ungroupSelected, setTool } = useCanvasStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.target as HTMLElement).isContentEditable) return

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
        return
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select');   break
        case 'h': setTool('pan');      break
        case 'l': setTool('line');     break
        case 'a': setTool('arrow');    break
        case 't': setTool('text');     break
        case 'p': setTool('freehand'); break
        case 'r': setTool('rect');     break
        case 'c': setTool('circle');   break
        case 'e': setTool('eraser' as any); break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, deleteSelected, groupSelected, ungroupSelected, setTool])
}