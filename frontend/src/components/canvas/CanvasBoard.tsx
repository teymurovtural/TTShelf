import { useRef, useState, useEffect } from 'react'
import Konva from 'konva'
import {
  Stage, Layer, Rect, Arrow, Text, Image as KonvaImage,
  Line, Transformer,
} from 'react-konva'
import { useCanvasStore } from '../../store/canvasStore'
import { uploadApi } from '../../api/upload'
import type { CanvasElement, ElementData } from '../../types'
import { v4 as uuidv4 } from 'uuid'

interface CanvasBoardProps {
  width: number
  height: number
}

// Default dəyərlər — ağ fon üçün tünd rənglər
const SHAPE_DEFAULTS = {
  rect:     { fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 2 },
  circle:   { fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 2 },
  line:     { stroke: '#374151', strokeWidth: 2 },
  arrow:    { stroke: '#6d28d9', strokeWidth: 2 },
  freehand: { stroke: '#374151', strokeWidth: 3 },
  text:     { fill: '#0f172a', fontSize: 20, fontFamily: 'Arial' },
}

export default function CanvasBoard({ width, height }: CanvasBoardProps) {
  const {
    elements, tool, selectedId,
    addElement, updateElement, setSelectedId, setTool,
  } = useCanvasStore()

  const stageRef      = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const textareaRef   = useRef<HTMLTextAreaElement | null>(null)
  const isDrawing     = useRef(false)
  const drawingId     = useRef<string | null>(null)

  const [stagePos,   setStagePos]   = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editPos,    setEditPos]    = useState({ x: 0, y: 0 })

  // Transformer — seçilmiş elementə bağla
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return
    if (selectedId && !editingId) {
      const node = stageRef.current.findOne(`#${selectedId}`)
      if (node) {
        transformerRef.current.nodes([node])
        transformerRef.current.getLayer()?.batchDraw()
        return
      }
    }
    transformerRef.current.nodes([])
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedId, editingId, elements])

  // Ctrl+V — şəkil paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (editingId) return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          try {
            const res = await uploadApi.image(file)
            const url = res.data.data.url
            const img = new window.Image()
            img.src = url
            img.onload = () => {
              addElement({
                id: uuidv4(), canvas_id: '', type: 'image',
                data: { x: 100, y: 100, width: img.width / 2, height: img.height / 2, src: url },
                z_index: elements.length,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            }
          } catch {}
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [editingId, elements.length])

  // Zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stageScale
    const pointer  = stage.getPointerPosition()
    if (!pointer) return
    const scaleBy  = 1.06
    const newScale = Math.min(Math.max(
      e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy,
      0.1,
    ), 8)
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    }
    setStageScale(newScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    })
  }

  const getPointerOnStage = () => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const pos = stage.getPointerPosition()
    if (!pos) return { x: 0, y: 0 }
    return {
      x: (pos.x - stagePos.x) / stageScale,
      y: (pos.y - stagePos.y) / stageScale,
    }
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Text editing açıqsa bağla
    if (editingId) {
      finishEditing()
      return
    }

    if (tool === 'select') {
      if (e.target === e.target.getStage()) setSelectedId(null)
      return
    }
    if (tool === 'pan') return

    const pos = getPointerOnStage()
    const id  = uuidv4()
    drawingId.current = id
    isDrawing.current = true

    let data: ElementData = {}

    if (tool === 'rect') {
      data = { x: pos.x, y: pos.y, width: 0, height: 0, ...SHAPE_DEFAULTS.rect }
    } else if (tool === 'circle') {
      data = { x: pos.x, y: pos.y, width: 0, height: 0, ...SHAPE_DEFAULTS.circle }
    } else if (tool === 'line') {
      data = { points: [pos.x, pos.y, pos.x, pos.y], ...SHAPE_DEFAULTS.line }
    } else if (tool === 'arrow') {
      data = { points: [pos.x, pos.y, pos.x, pos.y], ...SHAPE_DEFAULTS.arrow }
    } else if (tool === 'freehand') {
      data = { points: [pos.x, pos.y], ...SHAPE_DEFAULTS.freehand, lineCap: 'round', lineJoin: 'round' }
    } else if (tool === 'text') {
      data = { x: pos.x, y: pos.y, text: 'Mətn', ...SHAPE_DEFAULTS.text }
      isDrawing.current = false
    } else if (tool === 'image') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (ev) => {
        const file = (ev.target as HTMLInputElement).files?.[0]
        if (!file) return
        const res = await uploadApi.image(file)
        const url = res.data.data.url
        const img = new window.Image()
        img.src = url
        img.onload = () => {
          addElement({
            id: uuidv4(), canvas_id: '', type: 'image',
            data: { x: pos.x, y: pos.y, width: img.width / 2, height: img.height / 2, src: url },
            z_index: elements.length,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          })
        }
      }
      input.click()
      return
    }

    addElement({
      id, canvas_id: '', type: tool,
      data, z_index: elements.length,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current || !drawingId.current) return
    const pos = getPointerOnStage()
    const el  = elements.find((el) => el.id === drawingId.current)
    if (!el) return

    if (tool === 'rect' || tool === 'circle') {
      updateElement(drawingId.current, {
        width:  pos.x - (el.data.x || 0),
        height: pos.y - (el.data.y || 0),
      })
    } else if (tool === 'line' || tool === 'arrow') {
      const pts = el.data.points || []
      updateElement(drawingId.current, { points: [pts[0], pts[1], pos.x, pos.y] })
    } else if (tool === 'freehand') {
      updateElement(drawingId.current, {
        points: [...(el.data.points || []), pos.x, pos.y],
      })
    }
  }

  const handleMouseUp = () => {
    if (!isDrawing.current || !drawingId.current) return
    isDrawing.current = false
    setSelectedId(drawingId.current)
    drawingId.current = null
    setTool('select')
  }

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    updateElement(id, { x: e.target.x(), y: e.target.y() })
  }

  const handleTransformEnd = (id: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target
    updateElement(id, {
      x: node.x(), y: node.y(),
      width:  node.width()  * node.scaleX(),
      height: node.height() * node.scaleY(),
      rotation: node.rotation(),
      scaleX: 1, scaleY: 1,
    })
    node.scaleX(1)
    node.scaleY(1)
  }

  // Text double-click — native textarea ilə redaktə
  const startEditing = (el: CanvasElement) => {
    if (el.type !== 'text') return
    const stage = stageRef.current
    if (!stage) return

    const node = stage.findOne(`#${el.id}`) as Konva.Text
    if (!node) return

    // Textarea-nın stage üzərindəki mövqeyini hesabla
    const absPos = node.getAbsolutePosition()
    const stageBox = stage.container().getBoundingClientRect()

    setEditingId(el.id)
    setEditPos({
      x: stageBox.left + absPos.x,
      y: stageBox.top  + absPos.y,
    })

    node.hide()
    transformerRef.current?.hide()
    transformerRef.current?.getLayer()?.batchDraw()

    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const finishEditing = () => {
    if (!editingId) return
    const ta = textareaRef.current
    if (ta) {
      updateElement(editingId, { text: ta.value || ' ' })
    }

    const stage = stageRef.current
    if (stage) {
      const node = stage.findOne(`#${editingId}`) as Konva.Text
      node?.show()
      transformerRef.current?.show()
      transformerRef.current?.getLayer()?.batchDraw()
    }
    setEditingId(null)
  }

  const commonProps = (el: CanvasElement) => ({
    id: el.id,
    draggable: tool === 'select',
    opacity: el.data.opacity ?? 1,
    onClick: () => tool === 'select' && setSelectedId(el.id),
    onDblClick: () => el.type === 'text' && startEditing(el),
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el.id, e),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(el.id, e),
  })

  const renderElement = (el: CanvasElement) => {
    const d = el.data
    const cp = commonProps(el)

    switch (el.type) {
      case 'rect':
        return (
          <Rect key={el.id} {...cp}
            x={d.x} y={d.y}
            width={Math.abs(d.width  || 0)}
            height={Math.abs(d.height || 0)}
            offsetX={d.width  && d.width  < 0 ? Math.abs(d.width)  : 0}
            offsetY={d.height && d.height < 0 ? Math.abs(d.height) : 0}
            fill={d.fill === 'transparent' ? undefined : d.fill}
            stroke={d.stroke === 'transparent' ? undefined : d.stroke}
            strokeWidth={d.strokeWidth}
            rotation={d.rotation}
          />
        )
      case 'circle':
        return (
          <Rect key={el.id} {...cp}
            x={d.x} y={d.y}
            width={Math.abs(d.width  || 0)}
            height={Math.abs(d.height || 0)}
            offsetX={d.width  && d.width  < 0 ? Math.abs(d.width)  : 0}
            offsetY={d.height && d.height < 0 ? Math.abs(d.height) : 0}
            fill={d.fill === 'transparent' ? undefined : d.fill}
            stroke={d.stroke === 'transparent' ? undefined : d.stroke}
            strokeWidth={d.strokeWidth}
            cornerRadius={99999}
            rotation={d.rotation}
          />
        )
      case 'line':
        return (
          <Line key={el.id} {...cp}
            points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth}
            lineCap="round" lineJoin="round"
          />
        )
      case 'arrow':
        return (
          <Arrow key={el.id} {...cp}
            points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth}
            fill={d.stroke} pointerLength={10} pointerWidth={8}
          />
        )
      case 'freehand':
        return (
          <Line key={el.id} {...cp}
            points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth}
            tension={0.5} lineCap="round" lineJoin="round"
          />
        )
      case 'text':
        return (
          <Text key={el.id} {...cp}
            x={d.x} y={d.y}
            text={editingId === el.id ? '' : (d.text || '')}
            fontSize={d.fontSize} fill={d.fill}
            fontFamily={d.fontFamily} rotation={d.rotation}
          />
        )
      case 'image':
        return <ImageElement key={el.id} el={el} commonProps={cp} />
      default:
        return null
    }
  }

  // Editing textarea-nın fonu + ölçüsü
  const editingEl = editingId ? elements.find((e) => e.id === editingId) : null

  return (
    <div className="relative w-full h-full" style={{ background: '#ffffff' }}>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        draggable={tool === 'pan'}
        onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        style={{
          cursor: tool === 'pan' ? 'grab'
            : tool === 'select' ? 'default'
            : 'crosshair',
        }}
      >
        <Layer>
          {elements.map(renderElement)}
          <Transformer
            ref={transformerRef}
            boundBoxFunc={(oldBox, newBox) =>
              newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
            }
          />
        </Layer>
      </Stage>

      {/* Text editing overlay */}
      {editingId && editingEl && (
        <textarea
          ref={textareaRef}
          defaultValue={editingEl.data.text || ''}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Escape') finishEditing()
            // Shift+Enter — yeni sətir, Enter — bitir
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              finishEditing()
            }
          }}
          style={{
            position: 'fixed',
            top: editPos.y,
            left: editPos.x,
            fontSize: (editingEl.data.fontSize ?? 20) * stageScale,
            fontFamily: editingEl.data.fontFamily ?? 'Arial',
            color: editingEl.data.fill ?? '#0f172a',
            background: 'rgba(255,255,255,0.95)',
            border: '2px solid #4f46e5',
            borderRadius: 4,
            padding: '2px 4px',
            outline: 'none',
            minWidth: 60,
            minHeight: 30,
            resize: 'both',
            lineHeight: 1.2,
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        />
      )}
    </div>
  )
}

// Image element — useImage hook olmadan
function ImageElement({
  el, commonProps,
}: { el: CanvasElement; commonProps: object }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const d = el.data

  useEffect(() => {
    if (!d.src) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = d.src
    img.onload = () => setImage(img)
  }, [d.src])

  if (!image) return null

  return (
    <KonvaImage
      {...commonProps}
      x={d.x} y={d.y}
      width={d.width} height={d.height}
      image={image}
      rotation={d.rotation}
    />
  )
}
