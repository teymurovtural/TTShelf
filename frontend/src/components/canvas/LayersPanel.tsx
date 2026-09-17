import { useRef, useState } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import { Eye, EyeOff, Trash2, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from 'lucide-react'
import type { CanvasElement } from '../../types'

const TYPE_LABEL: Record<string, string> = {
  rect: '▭', circle: '●', line: '╱', arrow: '→',
  freehand: '✏', text: 'T', image: '🖼',
  triangle: '△', star: '★', pentagon: '⬠',
  hexagon: '⬡', diamond: '◇', parallelogram: '▱',
  cylinder: '⊙', cross: '✚',
}

const TYPE_NAME: Record<string, string> = {
  rect: 'Düzbucaqlı', circle: 'Dairə', line: 'Xətt', arrow: 'Ok',
  freehand: 'Çizgi', text: 'Mətn', image: 'Şəkil',
  triangle: 'Üçbucaq', star: 'Ulduz', pentagon: 'Beşbucaq',
  hexagon: 'Altıbucaq', diamond: 'Romb', parallelogram: 'Paraleloqram',
  cylinder: 'Silindr', cross: 'Xaç',
}

export default function LayersPanel() {
  const {
    elements, selectedIds, setSelectedIds,
    bringForward, sendBackward, bringToFront, sendToBack,
    swapZIndex,
  } = useCanvasStore()

  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const dragOver = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Z-index-ə görə azalan sıra (yuxarıdakı element üstdə)
  const sorted = [...elements].sort((a, b) => (b.z_index ?? 0) - (a.z_index ?? 0))

  const toggleHide = (id: string) => {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        useCanvasStore.getState().updateElement(id, { opacity: 1 })
      } else {
        next.add(id)
        useCanvasStore.getState().updateElement(id, { opacity: 0 })
      }
      return next
    })
  }

  const isSelected = (id: string) => selectedIds.includes(id)

  const handleClick = (el: CanvasElement, e: React.MouseEvent) => {
    if (e.shiftKey) {
      const newIds = isSelected(el.id)
        ? selectedIds.filter((id) => id !== el.id)
        : [...selectedIds, el.id]
      setSelectedIds(newIds)
    } else {
      setSelectedIds([el.id])
    }
  }

  // Drag-drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('layerId', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOver.current = id
    setDragOverId(id)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('layerId')
    if (!sourceId || sourceId === targetId) {
      setDragOverId(null)
      return
    }

    const sourceEl = elements.find((el) => el.id === sourceId)
    const targetEl = elements.find((el) => el.id === targetId)
    if (!sourceEl || !targetEl) return

    swapZIndex(sourceId, targetId)
    setDragOverId(null)
  }

  const handleDragEnd = () => {
    setDragOverId(null)
    dragOver.current = null
  }

  const label = (el: CanvasElement) => {
    if (el.type === 'text' && el.data.text?.trim()) {
      return `"${el.data.text.slice(0, 10)}${el.data.text.length > 10 ? '…' : ''}"`
    }
    return TYPE_NAME[el.type] ?? el.type
  }

  const activeId = selectedIds.length === 1 ? selectedIds[0] : null

  return (
    <div className="flex flex-col h-full">
      {/* Layer əməliyyat düymələri */}
      {activeId && (
        <div className="flex gap-1 px-2 py-1.5 border-b border-gray-100">
          <button onClick={() => bringToFront(activeId)} title="Ən üstə"
            className="flex-1 flex items-center justify-center py-1 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 transition-all">
            <ChevronsUp size={13} />
          </button>
          <button onClick={() => bringForward(activeId)} title="Bir üstə"
            className="flex-1 flex items-center justify-center py-1 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 transition-all">
            <ChevronUp size={13} />
          </button>
          <button onClick={() => sendBackward(activeId)} title="Bir aşağı"
            className="flex-1 flex items-center justify-center py-1 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 transition-all">
            <ChevronDown size={13} />
          </button>
          <button onClick={() => sendToBack(activeId)} title="Ən alta"
            className="flex-1 flex items-center justify-center py-1 rounded-lg bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 transition-all">
            <ChevronsDown size={13} />
          </button>
        </div>
      )}

      {/* Element siyahısı — drag-drop */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && (
          <div className="text-xs text-gray-300 text-center mt-8 px-3">Canvas boşdur</div>
        )}
        {sorted.map((el) => (
          <div
            key={el.id}
            draggable
            onDragStart={(e) => handleDragStart(e, el.id)}
            onDragOver={(e) => handleDragOver(e, el.id)}
            onDrop={(e) => handleDrop(e, el.id)}
            onDragEnd={handleDragEnd}
            onClick={(e) => handleClick(el, e)}
            className={`flex items-center gap-2 px-2 py-1.5 cursor-grab active:cursor-grabbing border-b border-gray-50 transition-colors select-none ${
              isSelected(el.id)
                ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
                : 'hover:bg-gray-50'
            } ${dragOverId === el.id ? 'border-t-2 border-t-indigo-400' : ''}`}
          >
            {/* İkon */}
            <span className="text-sm w-5 text-center shrink-0 text-gray-500">
              {TYPE_LABEL[el.type] ?? '▭'}
            </span>
            {/* Ad */}
            <span className={`text-xs flex-1 truncate ${hidden.has(el.id) ? 'text-gray-300' : 'text-gray-700'}`}>
              {label(el)}
            </span>
            {/* Gizlət */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleHide(el.id) }}
              className="text-gray-300 hover:text-gray-600 transition-colors shrink-0 p-0.5"
            >
              {hidden.has(el.id) ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            {/* Sil */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedIds([el.id])
                setTimeout(() => useCanvasStore.getState().deleteSelected(), 0)
              }}
              className="text-gray-200 hover:text-red-400 transition-colors shrink-0 p-0.5"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
