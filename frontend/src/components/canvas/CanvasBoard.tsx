import { useRef, useCallback, useState, useEffect } from 'react'
import Konva from 'konva'
import {
  Stage, Layer, Rect, Circle, Arrow, Text, Image as KonvaImage,
  Line, Transformer, Group
} from 'react-konva'
import { useCanvasStore } from '../../store/canvasStore'
import { uploadApi } from '../../api/upload'
import type { CanvasElement, ElementData } from '../../types'
import { v4 as uuidv4 } from 'uuid'

interface CanvasBoardProps {
  width: number
  height: number
}

const COLORS = {
  fill: '#3b82f6',
  stroke: '#1d4ed8',
  text: '#ffffff',
}

export default function CanvasBoard({ width, height }: CanvasBoardProps) {
  const {
    elements, tool, selectedId,
    addElement, updateElement, setSelectedId, setTool
  } = useCanvasStore()

  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const isDrawing = useRef(false)
  const drawingId = useRef<string | null>(null)

  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)

  // Transformer-i seçili elementə bağla
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return
    if (selectedId) {
      const node = stageRef.current.findOne(`#${selectedId}`)
      if (node) {
        transformerRef.current.nodes([node])
        transformerRef.current.getLayer()?.batchDraw()
      }
    } else {
      transformerRef.current.nodes([])
      transformerRef.current.getLayer()?.batchDraw()
    }
  }, [selectedId])

  // Ctrl+V — şəkil paste
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
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
              const el: CanvasElement = {
                id: uuidv4(),
                canvas_id: '',
                type: 'image',
                data: { x: 100, y: 100, width: img.width / 2, height: img.height / 2, src: url },
                z_index: elements.length,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
              addElement(el)
            }
          } catch (err) {
            console.error('Şəkil paste xətası:', err)
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [elements.length])

  // Zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const scaleBy = 1.05
    const oldScale = stageScale
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
    const clampedScale = Math.min(Math.max(newScale, 0.1), 5)
    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    }
    setStageScale(clampedScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
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
    if (tool === 'select') {
      if (e.target === e.target.getStage()) setSelectedId(null)
      return
    }
    if (tool === 'pan') return

    const pos = getPointerOnStage()
    const id = uuidv4()
    drawingId.current = id
    isDrawing.current = true

    let data: ElementData = {}
    if (tool === 'rect') {
      data = { x: pos.x, y: pos.y, width: 0, height: 0, fill: '#3b82f620', stroke: '#3b82f6', strokeWidth: 2 }
    } else if (tool === 'circle') {
      data = { x: pos.x, y: pos.y, width: 0, height: 0, fill: '#10b98120', stroke: '#10b981', strokeWidth: 2 }
    } else if (tool === 'line') {
      data = { points: [pos.x, pos.y, pos.x, pos.y], stroke: '#e2e8f0', strokeWidth: 2 }
    } else if (tool === 'arrow') {
      data = { points: [pos.x, pos.y, pos.x, pos.y], stroke: '#f59e0b', strokeWidth: 2 }
    } else if (tool === 'freehand') {
      data = { points: [pos.x, pos.y], stroke: '#e2e8f0', strokeWidth: 3, lineCap: 'round', lineJoin: 'round' }
    } else if (tool === 'text') {
      data = { x: pos.x, y: pos.y, text: 'Mətn', fontSize: 20, fill: '#ffffff', fontFamily: 'Arial' }
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
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    })
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!isDrawing.current || !drawingId.current) return
    const pos = getPointerOnStage()
    const el = elements.find((el) => el.id === drawingId.current)
    if (!el) return

    if (tool === 'rect' || tool === 'circle') {
      updateElement(drawingId.current, {
        width: pos.x - (el.data.x || 0),
        height: pos.y - (el.data.y || 0),
      })
    } else if (tool === 'line' || tool === 'arrow') {
      const pts = el.data.points || []
      updateElement(drawingId.current, {
        points: [pts[0], pts[1], pos.x, pos.y],
      })
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
      width: node.width() * node.scaleX(),
      height: node.height() * node.scaleY(),
      rotation: node.rotation(),
      scaleX: 1, scaleY: 1,
    })
    node.scaleX(1)
    node.scaleY(1)
  }

  const renderElement = (el: CanvasElement) => {
    const d = el.data
    const isSelected = selectedId === el.id
    const commonProps = {
      id: el.id,
      draggable: tool === 'select',
      onClick: () => tool === 'select' && setSelectedId(el.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el.id, e),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(el.id, e),
    }

    switch (el.type) {
      case 'rect':
        return <Rect key={el.id} {...commonProps}
          x={d.x} y={d.y} width={d.width} height={d.height}
          fill={d.fill} stroke={d.stroke} strokeWidth={d.strokeWidth}
          rotation={d.rotation} />
      case 'circle':
        return <Rect key={el.id} {...commonProps}
          x={d.x} y={d.y} width={d.width} height={d.height}
          fill={d.fill} stroke={d.stroke} strokeWidth={d.strokeWidth}
          cornerRadius={9999} rotation={d.rotation} />
      case 'line':
        return <Line key={el.id} {...commonProps}
          points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth}
          lineCap="round" lineJoin="round" />
      case 'arrow':
        return <Arrow key={el.id} {...commonProps}
          points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth}
          fill={d.stroke} pointerLength={10} pointerWidth={8} />
      case 'freehand':
        return <Line key={el.id} {...commonProps}
          points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth}
          tension={0.5} lineCap="round" lineJoin="round" />
      case 'text':
        return <Text key={el.id} {...commonProps}
          x={d.x} y={d.y} text={d.text} fontSize={d.fontSize}
          fill={d.fill} fontFamily={d.fontFamily} rotation={d.rotation} />
      case 'image':
        return <ImageElement key={el.id} el={el} commonProps={commonProps} />
      default:
        return null
    }
  }

  return (
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
      onDragEnd={(e) => {
        setStagePos({ x: e.target.x(), y: e.target.y() })
      }}
      style={{ background: '#0f172a', cursor: tool === 'pan' ? 'grab' : 'crosshair' }}
    >
      <Layer>
        {elements.map(renderElement)}
        <Transformer ref={transformerRef} />
      </Layer>
    </Stage>
  )
}

// Image elementi ayrıca komponent — useImage hook-u istifadə edir
function ImageElement({ el, commonProps }: {
  el: CanvasElement
  commonProps: object
}) {
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
