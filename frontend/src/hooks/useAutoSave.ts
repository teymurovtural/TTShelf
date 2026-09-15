import { useEffect, useRef } from 'react'
import { canvasApi } from '../api/canvas'
import { useCanvasStore } from '../store/canvasStore'

export function useAutoSave(canvasId: string, intervalMs = 2000) {
  const { elements, isDirty, setDirty } = useCanvasStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isDirty || !canvasId) return

    if (timerRef.current) clearTimeout(timerRef.current)

    timerRef.current = setTimeout(async () => {
      try {
        const batch = elements.map((el, idx) => ({
          id: el.id,
          type: el.type,
          data: el.data,
          z_index: idx,
        }))
        await canvasApi.batchSave(canvasId, batch)
        setDirty(false)
      } catch (err) {
        console.error('Auto-save xətası:', err)
      }
    }, intervalMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [elements, isDirty, canvasId, intervalMs])
}
