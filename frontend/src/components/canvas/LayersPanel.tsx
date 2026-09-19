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

const btn = (active = false) => ({
  flex: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '5px 0',
  borderRadius: 7,
  border: '1px solid rgba(255,255,255,0.08)',
  background: active ? '#4f46e5' : 'rgba(255,255,255,0.04)',
  color: active ? '#fff' : '#7070a0',
  cursor: 'pointer',
  transition: 'background 0.12s, color 0.12s',
})

export default function LayersPanel() {
  const {
    elements, selectedIds, setSelectedIds,
    bringForward, sendBackward, bringToFront, sendToBack,
    swapZIndex,
  } = useCanvasStore()

  const [hidden, setHidden]       = useState<Set<string>>(new Set())
  const dragOver                  = useRef<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

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
    if (!sourceId || sourceId === targetId) { setDragOverId(null); return }
    swapZIndex(sourceId, targetId)
    setDragOverId(null)
  }

  const handleDragEnd = () => { setDragOverId(null); dragOver.current = null }

  const label = (el: CanvasElement) => {
    if (el.type === 'text' && el.data.text?.trim())
      return `"${el.data.text.slice(0, 14)}${el.data.text.length > 14 ? '…' : ''}"`
    return TYPE_NAME[el.type] ?? el.type
  }

  const activeId = selectedIds.length === 1 ? selectedIds[0] : null

  return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Sıra əməliyyatları */}
        {activeId && (
            <div style={{
              display: 'flex', gap: 4, padding: '8px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              {[
                { icon: <ChevronsUp size={13} />,   action: () => bringToFront(activeId), title: 'Ən üstə'  },
                { icon: <ChevronUp size={13} />,     action: () => bringForward(activeId), title: 'Bir üstə' },
                { icon: <ChevronDown size={13} />,   action: () => sendBackward(activeId), title: 'Bir aşağı'},
                { icon: <ChevronsDown size={13} />,  action: () => sendToBack(activeId),   title: 'Ən alta'  },
              ].map(({ icon, action, title }, i) => (
                  <button
                      key={i}
                      onClick={action}
                      title={title}
                      style={btn()}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#2d2d44'; (e.currentTarget as HTMLElement).style.color = '#e0e0f0' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#7070a0' }}
                  >
                    {icon}
                  </button>
              ))}
            </div>
        )}

        {/* Element siyahısı */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sorted.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: '#3a3a5a' }}>
                Canvas boşdur
              </div>
          )}

          {sorted.map((el) => {
            const selected = isSelected(el.id)
            const isHidden = hidden.has(el.id)
            const isDragTarget = dragOverId === el.id

            return (
                <div
                    key={el.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, el.id)}
                    onDragOver={(e) => handleDragOver(e, el.id)}
                    onDrop={(e) => handleDrop(e, el.id)}
                    onDragEnd={handleDragEnd}
                    onClick={(e) => handleClick(el, e)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px',
                      cursor: 'grab',
                      userSelect: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      borderLeft: selected ? '2px solid #4f46e5' : '2px solid transparent',
                      background: selected
                          ? 'rgba(79,70,229,0.15)'
                          : isDragTarget
                              ? 'rgba(99,102,241,0.1)'
                              : 'transparent',
                      borderTop: isDragTarget ? '1px solid #6366f1' : '1px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                >
                  {/* Type ikonu */}
                  <span style={{ fontSize: 13, width: 18, textAlign: 'center', flexShrink: 0, color: selected ? '#818cf8' : '#5050780' }}>
                {TYPE_LABEL[el.type] ?? '▭'}
              </span>

                  {/* Ad */}
                  <span style={{
                    fontSize: 11, flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: isHidden ? '#3a3a5a' : selected ? '#c8c8ff' : '#9090b0',
                  }}>
                {label(el)}
              </span>

                  {/* Gizlət */}
                  <button
                      onClick={(e) => { e.stopPropagation(); toggleHide(el.id) }}
                      title={isHidden ? 'Göstər' : 'Gizlət'}
                      style={{
                        width: 20, height: 20, borderRadius: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: isHidden ? '#4f46e5' : '#3a3a5a',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#818cf8' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isHidden ? '#4f46e5' : '#3a3a5a' }}
                  >
                    {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                  </button>

                  {/* Sil */}
                  <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedIds([el.id])
                        setTimeout(() => useCanvasStore.getState().deleteSelected(), 0)
                      }}
                      title="Sil"
                      style={{
                        width: 20, height: 20, borderRadius: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#3a3a5a', flexShrink: 0,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#3a3a5a' }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
            )
          })}
        </div>
      </div>
  )
}