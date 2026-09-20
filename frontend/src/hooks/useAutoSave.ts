import { useEffect, useRef } from 'react'
import { pagesApi } from '../api/pages'
import { useCanvasStore } from '../store/canvasStore'
import { usePageStore } from '../store/pageStore'

export function useAutoSave(canvasId: string, intervalMs = 2000) {
    const { elements, isDirty, setDirty } = useCanvasStore()
    const { activePageId } = usePageStore()
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (!isDirty || !canvasId || !activePageId) return

        if (timerRef.current) clearTimeout(timerRef.current)

        timerRef.current = setTimeout(async () => {
            try {
                const batch = elements.map((el, idx) => ({
                    id: el.id,
                    type: el.type,
                    data: el.data,
                    z_index: idx,
                }))
                await pagesApi.batchSave(canvasId, activePageId, batch)
                setDirty(false)
            } catch (err) {
                console.error('Auto-save xətası:', err)
            }
        }, intervalMs)

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
        }
    }, [elements, isDirty, canvasId, activePageId, intervalMs])
}
