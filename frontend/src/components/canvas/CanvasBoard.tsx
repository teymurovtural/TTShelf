import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import Konva from 'konva'
import {
  Stage, Layer, Rect, Arrow, Text, Image as KonvaImage,
  Line, Transformer, RegularPolygon, Star as KonvaStar, Ellipse, Group, Path,
} from 'react-konva'
import { useCanvasStore } from '../../store/canvasStore'
import { uploadApi } from '../../api/upload'
import type { CanvasElement, ElementData } from '../../types'
import { v4 as uuidv4 } from 'uuid'

// ---- Rounded polygon path helpers ----
function roundedPolygonPath(points: number[][], radius: number): string {
  const n = points.length
  let path = ''
  for (let i = 0; i < n; i++) {
    const curr = points[i]
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const dx1 = prev[0] - curr[0]; const dy1 = prev[1] - curr[1]
    const d1 = Math.sqrt(dx1*dx1 + dy1*dy1)
    const ux1 = dx1/d1; const uy1 = dy1/d1
    const dx2 = next[0] - curr[0]; const dy2 = next[1] - curr[1]
    const d2 = Math.sqrt(dx2*dx2 + dy2*dy2)
    const ux2 = dx2/d2; const uy2 = dy2/d2
    const r = Math.min(radius, d1/2, d2/2)
    const p1 = [curr[0] + ux1*r, curr[1] + uy1*r]
    const p2 = [curr[0] + ux2*r, curr[1] + uy2*r]
    if (i === 0) path += `M ${p1[0]} ${p1[1]} `
    else path += `L ${p1[0]} ${p1[1]} `
    path += `Q ${curr[0]} ${curr[1]} ${p2[0]} ${p2[1]} `
  }
  return path + 'Z'
}

function regularPolygonPoints(sides: number, radius: number, cx: number, cy: number): number[][] {
  const pts: number[][] = []
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i / sides) - Math.PI/2
    pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)])
  }
  return pts
}

function starPoints(numPoints: number, outerR: number, innerR: number, cx: number, cy: number): number[][] {
  const pts: number[][] = []
  for (let i = 0; i < numPoints * 2; i++) {
    const angle = (Math.PI * i / numPoints) - Math.PI/2
    const r = i % 2 === 0 ? outerR : innerR
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  return pts
}
// ---- End helpers ----


interface CanvasBoardProps { width: number; height: number }
export interface CanvasBoardHandle { exportImage: () => string | null }

const SHAPE_DEFAULTS = {
  rect:          { fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 2 },
  circle:        { fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 2 },
  triangle:      { fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 2 },
  diamond:       { fill: '#f3e8ff', stroke: '#8b5cf6', strokeWidth: 2 },
  pentagon:      { fill: '#fee2e2', stroke: '#ef4444', strokeWidth: 2 },
  hexagon:       { fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 2 },
  star:          { fill: '#fef3c7', stroke: '#f59e0b', strokeWidth: 2 },
  parallelogram: { fill: '#dcfce7', stroke: '#22c55e', strokeWidth: 2 },
  cross:         { fill: '#fee2e2', stroke: '#ef4444', strokeWidth: 2 },
  cylinder:      { fill: '#dbeafe', stroke: '#3b82f6', strokeWidth: 2 },
  line:          { stroke: '#374151', strokeWidth: 2 },
  arrow:         { stroke: '#6d28d9', strokeWidth: 2 },
  freehand:      { stroke: '#374151', strokeWidth: 3 },
  text:          { fill: '#0f172a', fontSize: 20, fontFamily: 'Arial' },
}

const CanvasBoard = forwardRef<CanvasBoardHandle, CanvasBoardProps>(
  function CanvasBoard({ width, height }, ref) {

  const {
    elements, tool, selectedId, selectedIds,
    addElement, updateElement, deleteSelected,
    setSelectedId, setSelectedIds, setTool, pushHistory,
  } = useCanvasStore()

  const stageRef       = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const textareaRef    = useRef<HTMLTextAreaElement | null>(null)
  const isDrawing      = useRef(false)
  const drawingId      = useRef<string | null>(null)
  const stagePosRef    = useRef({ x: 0, y: 0 })
  const stageScaleRef  = useRef(1)
  const isSpaceDown    = useRef(false)
  const isShiftDown    = useRef(false)
  const isPanning      = useRef(false)
  const lastPanPos     = useRef({ x: 0, y: 0 })
  const elementsRef    = useRef(elements)

  // Multi-drag
  const isDraggingGroup   = useRef(false)
  const dragStartPositions = useRef<Record<string, { x: number; y: number }>>({})

  const [stagePos,   setStagePos]   = useState({ x: 0, y: 0 })
  const [stageScale, setStageScale] = useState(1)
  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editPos,    setEditPos]    = useState({ x: 0, y: 0, scale: 1 })
  const [isSpacePan, setIsSpacePan] = useState(false)

  // Rubber band selection state
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const selBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const selStart  = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => { stagePosRef.current = stagePos },   [stagePos])
  useEffect(() => { stageScaleRef.current = stageScale }, [stageScale])
  useEffect(() => { elementsRef.current = elements },     [elements])

  // Export
  useImperativeHandle(ref, () => ({
    exportImage: () => {
      if (!stageRef.current) return null
      const tr = transformerRef.current
      tr?.hide(); stageRef.current.batchDraw()
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
      tr?.show(); stageRef.current.batchDraw()
      return dataUrl
    },
  }))

  // Transformer — YALNIZ tək element seçiləndə işlət
  // Çoxlu seçimdə Transformer.nodes([]) — viewport-u tərpətməsin
  useEffect(() => {
    const tr    = transformerRef.current
    const stage = stageRef.current
    if (!tr || !stage) return

    if (selectedIds.length === 1 && !editingId) {
      const node = stage.findOne(`#${selectedIds[0]}`)
      if (node) {
        // Stage pozisiyasını saxla
        const px = stage.x(); const py = stage.y()
        const sx = stage.scaleX(); const sy = stage.scaleY()
        tr.nodes([node])
        // Dərhal bərpa et
        stage.x(px); stage.y(py)
        stage.scaleX(sx); stage.scaleY(sy)
        stage.batchDraw()
        return
      }
    }
    // Multi-select və ya boş — transformer söndür
    tr.nodes([])
    tr.getLayer()?.batchDraw()
  }, [selectedIds, editingId, elements])

  // Space + drag pan
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        isSpaceDown.current = true
        setIsSpacePan(true)
      }
      if (e.key === 'Shift') isShiftDown.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceDown.current = false
        isPanning.current   = false
        setIsSpacePan(false)
      }
      if (e.key === 'Shift') isShiftDown.current = false
    }
    const onMouseDown = (e: MouseEvent) => {
      if (isSpaceDown.current && e.button === 0) {
        isPanning.current  = true
        lastPanPos.current = { x: e.clientX, y: e.clientY }
      }
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!isPanning.current) return
      const dx = e.clientX - lastPanPos.current.x
      const dy = e.clientY - lastPanPos.current.y
      lastPanPos.current = { x: e.clientX, y: e.clientY }
      const newPos = { x: stagePosRef.current.x + dx, y: stagePosRef.current.y + dy }
      stagePosRef.current = newPos
      setStagePos({ ...newPos })
    }
    const onMouseUp = () => { isPanning.current = false }

    window.addEventListener('keydown',   onKeyDown)
    window.addEventListener('keyup',     onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('keydown',   onKeyDown)
      window.removeEventListener('keyup',     onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

  // Delete key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected])

  // Ctrl+V paste
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
                data: { x: 100, y: 100, width: Math.min(img.width / 2, 600), height: Math.min(img.height / 2, 600), src: url },
                z_index: elements.length,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              })
            }
          } catch (err) { console.error('Paste upload:', err) }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [editingId, elements.length, addElement])

  // Zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stageScaleRef.current
    const pointer  = stage.getPointerPosition()
    if (!pointer) return
    const scaleBy  = 1.06
    const newScale = Math.min(Math.max(e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy, 0.05), 10)
    const newPos = {
      x: pointer.x - (pointer.x - stagePosRef.current.x) / oldScale * newScale,
      y: pointer.y - (pointer.y - stagePosRef.current.y) / oldScale * newScale,
    }
    setStageScale(newScale)
    setStagePos(newPos)
  }

  const getPointerOnStage = () => {
    const stage = stageRef.current
    if (!stage) return { x: 0, y: 0 }
    const pos = stage.getPointerPosition()
    if (!pos) return { x: 0, y: 0 }
    return {
      x: (pos.x - stagePosRef.current.x) / stageScaleRef.current,
      y: (pos.y - stagePosRef.current.y) / stageScaleRef.current,
    }
  }

  // Text editing
  const startEditing = (el: CanvasElement) => {
    if (el.type !== 'text') return
    const stage = stageRef.current
    if (!stage) return
    const node = stage.findOne(`#${el.id}`) as Konva.Text
    if (!node) return
    const stageBox = stage.container().getBoundingClientRect()
    const absPos   = node.getAbsolutePosition()
    setEditingId(el.id)
    setEditPos({ x: stageBox.left + absPos.x, y: stageBox.top + absPos.y, scale: stageScaleRef.current })
    node.hide()
    transformerRef.current?.hide()
    transformerRef.current?.getLayer()?.batchDraw()
    setTimeout(() => { textareaRef.current?.focus(); textareaRef.current?.select() }, 10)
  }

  const finishEditing = () => {
    if (!editingId) return
    const ta = textareaRef.current
    if (ta) { pushHistory(); updateElement(editingId, { text: ta.value || ' ' }) }
    const stage = stageRef.current
    if (stage) {
      const node = stage.findOne(`#${editingId}`) as Konva.Text
      node?.show()
      transformerRef.current?.show()
      transformerRef.current?.getLayer()?.batchDraw()
    }
    setEditingId(null)
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSpaceDown.current) return
    if (editingId) { finishEditing(); return }
    if (tool === 'pan') return



    const pos      = getPointerOnStage()
    const isStage  = e.target === e.target.getStage()

    if (tool === 'select') {
      if (isStage) {
        // Boş yerdə rubber band başlat
        setSelectedIds([])
        selStart.current = pos
        selBoxRef.current = { x: pos.x, y: pos.y, w: 0, h: 0 }
        setSelBox({ x: pos.x, y: pos.y, w: 0, h: 0 })
      }
      return
    }



    const id = uuidv4()
    drawingId.current  = id
    isDrawing.current  = true
    let data: ElementData = {}

    if (tool === 'rect') {
      data = { x: pos.x, y: pos.y, width: 0, height: 0, ...SHAPE_DEFAULTS.rect }
    } else if (tool === 'circle') {
      data = { x: pos.x, y: pos.y, width: 0, height: 0, ...SHAPE_DEFAULTS.circle }
    } else if (['triangle','pentagon','hexagon','star'].includes(tool)) {
      const defaults = (SHAPE_DEFAULTS as any)[tool] ?? SHAPE_DEFAULTS.rect
      // Mərkəz koordinat sistemi — x/y mərkəzdir
      data = { x: pos.x, y: pos.y, width: 0, height: 0, ...defaults }
    } else if (['diamond','parallelogram','cross','cylinder'].includes(tool)) {
      const defaults = (SHAPE_DEFAULTS as any)[tool] ?? SHAPE_DEFAULTS.rect
      data = { x: pos.x, y: pos.y, width: 0, height: 0, ...defaults }
    } else if (tool === 'line') {
      data = { points: [pos.x, pos.y, pos.x, pos.y], ...SHAPE_DEFAULTS.line }
    } else if (tool === 'arrow') {
      data = { points: [pos.x, pos.y, pos.x, pos.y], ...SHAPE_DEFAULTS.arrow }
    } else if (tool === 'freehand') {
      data = { points: [pos.x, pos.y], ...SHAPE_DEFAULTS.freehand, lineCap: 'round', lineJoin: 'round' }
    } else if (tool === 'text') {
      data = { x: pos.x, y: pos.y, text: '', ...SHAPE_DEFAULTS.text }
      isDrawing.current = false; drawingId.current = null
      const newEl: CanvasElement = {
        id, canvas_id: '', type: 'text', data,
        z_index: elements.length,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      addElement(newEl)
      setSelectedIds([id])
      setTool('select')
      setTimeout(() => startEditing(newEl), 50)
      return
    }

    addElement({ id, canvas_id: '', type: tool, data, z_index: elements.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = getPointerOnStage()

    // Rubber band — yalnız select alətində
    if (selStart.current) {
      const sx = selStart.current.x
      const sy = selStart.current.y
      const nb = {
        x: Math.min(pos.x, sx), y: Math.min(pos.y, sy),
        w: Math.abs(pos.x - sx), h: Math.abs(pos.y - sy),
      }
      selBoxRef.current = nb
      setSelBox(nb)
      return
    }

    if (!isDrawing.current || !drawingId.current) return
    const el = elements.find((el) => el.id === drawingId.current)
    if (!el) return

    if (['rect','circle','diamond','parallelogram','cross','cylinder'].includes(tool)) {
      let w = pos.x - (el.data.x || 0)
      let h = pos.y - (el.data.y || 0)
      if (isShiftDown.current) {
        const side = Math.max(Math.abs(w), Math.abs(h))
        w = w < 0 ? -side : side
        h = h < 0 ? -side : side
      }
      updateElement(drawingId.current, { width: w, height: h })
    } else if (['triangle','pentagon','hexagon','star'].includes(tool)) {
      // Mərkəzdən radius kimi çək — x/y sabit qalır (başlanğıc = mərkəz)
      let radius = Math.max(Math.abs(pos.x - (el.data.x || 0)), Math.abs(pos.y - (el.data.y || 0)))
      if (isShiftDown.current) {
        // Shift: simmetrik
      }
      updateElement(drawingId.current, { width: radius * 2, height: radius * 2 })
    } else if (tool === 'line' || tool === 'arrow') {
      const pts = el.data.points || []
      let ex = pos.x; let ey = pos.y
      if (isShiftDown.current) {
        // Shift: 45° snap
        const dx = pos.x - pts[0]; const dy = pos.y - pts[1]
        const angle = Math.atan2(dy, dx)
        const snap = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
        const dist = Math.sqrt(dx * dx + dy * dy)
        ex = pts[0] + Math.cos(snap) * dist
        ey = pts[1] + Math.sin(snap) * dist
      }
      updateElement(drawingId.current, { points: [pts[0], pts[1], ex, ey] })
    } else if (tool === 'freehand') {
      updateElement(drawingId.current, { points: [...(el.data.points || []), pos.x, pos.y] })
    }
  }

  const handleMouseUp = () => {
    // Rubber band bitdi — içindəki elementləri seç
    if (selStart.current) {
      const currentBox = selBoxRef.current
      if (currentBox && currentBox.w > 5 && currentBox.h > 5) {
        const { x, y, w, h } = currentBox
        const inside = elementsRef.current.filter((el) => {
          const bb = getElBBox(el)
          return bb.x >= x && bb.y >= y &&
                 (bb.x + bb.w) <= (x + w) &&
                 (bb.y + bb.h) <= (y + h)
        }).map((el) => el.id)
        setSelectedIds(inside)
      } else {
        // Kiçik klik — seçimi sıfırla
        setSelectedIds([])
      }
      selStart.current = null
      selBoxRef.current = null
      setSelBox(null)
      return
    }

    if (!isDrawing.current || !drawingId.current) return
    isDrawing.current = false
    setSelectedIds([drawingId.current])
    drawingId.current = null
    setTool('select')
  }

  // Element drag — tək və ya group
  const handleDragStart = (id: string) => {
    if (selectedIds.length > 1 && selectedIds.includes(id)) {
      isDraggingGroup.current = true
      // Hər elementin başlanğıc mövqeyini saxla
      const positions: Record<string, { x: number; y: number }> = {}
      elements.forEach((el) => {
        if (selectedIds.includes(el.id)) {
          positions[el.id] = { x: el.data.x ?? 0, y: el.data.y ?? 0 }
        }
      })
      dragStartPositions.current = positions
    }
  }


  // Element bounding box — sol yuxarı künc + ölçü
  const getElBBox = (el: CanvasElement) => {
    const d = el.data
    const isCentered = ['triangle','pentagon','hexagon','star'].includes(el.type)
    if (d.points && d.points.length >= 2) {
      const pts = d.points
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (let i = 0; i < pts.length - 1; i += 2) {
        minX = Math.min(minX, pts[i]);   maxX = Math.max(maxX, pts[i])
        minY = Math.min(minY, pts[i+1]); maxY = Math.max(maxY, pts[i+1])
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
    }
    if (isCentered) {
      const r = Math.abs(d.width ?? 0) / 2
      return { x: (d.x ?? 0) - r, y: (d.y ?? 0) - r, w: r * 2, h: r * 2 }
    }
    return {
      x: d.x ?? 0, y: d.y ?? 0,
      w: Math.abs(d.width ?? 0), h: Math.abs(d.height ?? 0)
    }
  }

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    pushHistory()
    const el = elementsRef.current.find((el) => el.id === id)
    if (isDraggingGroup.current && selectedIds.length > 1 && selectedIds.includes(id)) {
      const newX = e.target.x()
      const newY = e.target.y()
      const startPos = dragStartPositions.current[id]
      if (startPos) {
        const dx = newX - startPos.x
        const dy = newY - startPos.y
        selectedIds.forEach((sid) => {
          const sp = dragStartPositions.current[sid]
          if (sp) updateElement(sid, { x: sp.x + dx, y: sp.y + dy })
        })
      }
      isDraggingGroup.current = false
    } else {
      updateElement(id, { x: e.target.x(), y: e.target.y() })
    }
  }

  const handleTransformEnd = (id: string, e: Konva.KonvaEventObject<Event>) => {
    pushHistory()
    const node = e.target
    const el   = elementsRef.current.find((el) => el.id === id)
    if (!el) return

    if (['line', 'arrow', 'freehand'].includes(el.type)) {
      const sx = node.scaleX(); const sy = node.scaleY()
      const pts = el.data.points || []
      updateElement(id, { points: pts.map((v, i) => i % 2 === 0 ? v * sx : v * sy), scaleX: 1, scaleY: 1 })
      node.scaleX(1); node.scaleY(1)
      return
    }

    const isCenteredPath = ['triangle','pentagon','hexagon','star','cross','parallelogram','cylinder','diamond'].includes(el.type)

    if (isCenteredPath) {
      // Path/Group shape-lər üçün: scale-i width-ə çevir
      const sx = node.scaleX(); const sy = node.scaleY()
      const oldW = Math.abs(el.data.width ?? 0)
      const oldH = Math.abs(el.data.height ?? 0)
      const newW = oldW * Math.abs(sx)
      const newH = oldH * Math.abs(sy)

      const isCentered = ['triangle','pentagon','hexagon','star'].includes(el.type)
      if (isCentered) {
        // Mərkəz koordinat — x/y mərkəzdir, ölçü dəyişəndə yenilə
        updateElement(id, {
          x: node.x(),
          y: node.y(),
          width: newW,
          height: newW, // simmetrik saxla
          rotation: node.rotation(),
          scaleX: 1, scaleY: 1,
        })
      } else {
        updateElement(id, {
          x: node.x(),
          y: node.y(),
          width: newW,
          height: newH,
          rotation: node.rotation(),
          scaleX: 1, scaleY: 1,
        })
      }
      node.scaleX(1); node.scaleY(1)
      return
    }

    // Rect, circle, diamond, cylinder, image, text
    updateElement(id, {
      x: node.x(), y: node.y(),
      width:  node.width()  * node.scaleX(),
      height: node.height() * node.scaleY(),
      rotation: node.rotation(), scaleX: 1, scaleY: 1,
    })
    node.scaleX(1); node.scaleY(1)
  }

  const handleElementClick = (el: CanvasElement, e: Konva.KonvaEventObject<MouseEvent>) => {
    if (tool !== 'select') return

    // Group seçimi — bu elementin groupId-si varsa, hamısını seç
    const groupId = el.data.groupId as string | undefined
    const groupMemberIds = groupId
      ? elements.filter((e) => e.data.groupId === groupId).map((e) => e.id)
      : [el.id]

    if (e.evt.shiftKey) {
      // Shift+klik — əlavə seç / çıxart
      const allSelected = groupMemberIds.every((id) => selectedIds.includes(id))
      if (allSelected) {
        setSelectedIds(selectedIds.filter((id) => !groupMemberIds.includes(id)))
      } else {
        setSelectedIds([...new Set([...selectedIds, ...groupMemberIds])])
      }
    } else {
      setSelectedIds(groupMemberIds)
    }
  }

  const commonProps = (el: CanvasElement) => ({
    id: el.id,
    draggable: tool === 'select',
    opacity: el.data.opacity ?? 1,
    onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true
      handleElementClick(el, e)
    },
    onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true
      if (el.type === 'text') startEditing(el)
    },
    onDragStart: () => handleDragStart(el.id),
    onDragEnd:   (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el.id, e),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(el.id, e),
  })

  const renderElement = (el: CanvasElement) => {
    const d = el.data; const cp = commonProps(el)
    switch (el.type) {
      case 'rect':
        return <Rect key={el.id} {...cp} x={d.x} y={d.y}
          width={Math.abs(d.width||0)} height={Math.abs(d.height||0)}
          offsetX={d.width&&d.width<0?Math.abs(d.width):0} offsetY={d.height&&d.height<0?Math.abs(d.height):0}
          fill={d.fill==='transparent'?undefined:d.fill} stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={d.rotation}
          cornerRadius={d.cornerRadius as any ?? 0} />
      case 'circle':
        return <Rect key={el.id} {...cp} x={d.x} y={d.y}
          width={Math.abs(d.width||0)} height={Math.abs(d.height||0)}
          offsetX={d.width&&d.width<0?Math.abs(d.width):0} offsetY={d.height&&d.height<0?Math.abs(d.height):0}
          fill={d.fill==='transparent'?undefined:d.fill} stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth}
          cornerRadius={d.cornerRadius as any ?? 99999} rotation={d.rotation} />
      case 'line':
        return <Line key={el.id} {...cp} points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth} lineCap="round" lineJoin="round" />
      case 'arrow':
        return <Arrow key={el.id} {...cp} points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth} fill={d.stroke} pointerLength={12} pointerWidth={10} />
      case 'freehand':
        return <Line key={el.id} {...cp} points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth} tension={0.5} lineCap="round" lineJoin="round" />
      case 'text':
        return <Text key={el.id} {...cp} x={d.x} y={d.y}
          text={editingId===el.id?'':(d.text||'')} fontSize={d.fontSize||20}
          fill={d.fill||'#0f172a'} fontFamily={d.fontFamily||'Arial'} rotation={d.rotation} />
      case 'triangle':
      case 'pentagon':
      case 'hexagon': {
        const sides = el.type === 'triangle' ? 3 : el.type === 'pentagon' ? 5 : 6
        const radius = Math.abs(d.width??0) / 2
        const cr = (d.cornerRadius as any) ?? 0
        const pts = regularPolygonPoints(sides, radius, 0, 0)
        const pathData = roundedPolygonPath(pts, cr)
        return <Path key={el.id} {...cp}
          x={d.x??0} y={d.y??0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={(d.rotation??0)} />
      }

      case 'star': {
        const outerR = Math.abs(d.width??0) / 2
        const cr = (d.cornerRadius as any) ?? 0
        const pts = starPoints(5, outerR, outerR * 0.45, 0, 0)
        const pathData = roundedPolygonPath(pts, cr)
        return <Path key={el.id} {...cp}
          x={d.x??0} y={d.y??0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={(d.rotation??0)} />
      }

      case 'diamond':
        return <Rect key={el.id} {...cp}
          x={(d.x??0) + Math.abs(d.width??0)/2} y={d.y}
          width={Math.abs(d.width??0)} height={Math.abs(d.height??0)}
          offsetX={Math.abs(d.width??0)/2}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={(d.rotation??0) + 45}
          cornerRadius={d.cornerRadius as any ?? 0}
          scaleX={0.7} />

      case 'parallelogram': {
        const pw = Math.abs(d.width??0); const ph = Math.abs(d.height??0)
        const fill = d.fill==='transparent'?undefined:d.fill
        const stroke = d.stroke==='transparent'?undefined:d.stroke
        return (
          <Group key={el.id} {...cp} x={d.x??0} y={d.y??0} rotation={d.rotation??0}>
            <Rect
              x={pw * 0.2} y={0}
              width={pw * 0.8} height={ph}
              skewX={-0.35}
              fill={fill} stroke={stroke}
              strokeWidth={d.strokeWidth}
              cornerRadius={d.cornerRadius as any ?? 0}
            />
          </Group>
        )
      }

      case 'cross': {
        const cw = Math.abs(d.width??0); const ch = Math.abs(d.height??0)
        const t = cw/3; const t2 = ch/3
        const cr = (d.cornerRadius as any) ?? 0
        // Cross-u rounded polygon path ilə çək
        const crossPts = [
          [t, 0], [cw-t, 0],
          [cw-t, t2], [cw, t2],
          [cw, ch-t2], [cw-t, ch-t2],
          [cw-t, ch], [t, ch],
          [t, ch-t2], [0, ch-t2],
          [0, t2], [t, t2],
        ]
        const pathData = roundedPolygonPath(crossPts, cr)
        return <Path key={el.id} {...cp}
          x={d.x??0} y={d.y??0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={(d.rotation??0)} />
      }

      case 'cylinder': {
        const cyW = Math.abs(d.width??0); const cyH = Math.abs(d.height??0)
        const ry = Math.max(cyH * 0.15, 8)
        const fill = d.fill==='transparent'?undefined:d.fill
        const stroke = d.stroke==='transparent'?undefined:d.stroke
        return (
          <Group key={el.id} {...cp} x={d.x??0} y={d.y??0}>
            {/* Gövdə */}
            <Rect
              x={0} y={ry} width={cyW} height={cyH - ry*2}
              fill={fill} stroke={stroke} strokeWidth={d.strokeWidth} />
            {/* Alt ellips (əvvəl çəkilir ki üst üstündə olsun) */}
            <Ellipse
              x={cyW/2} y={cyH - ry}
              radiusX={cyW/2} radiusY={ry}
              fill={fill} stroke={stroke} strokeWidth={d.strokeWidth} />
            {/* Üst ellips */}
            <Ellipse
              x={cyW/2} y={ry}
              radiusX={cyW/2} radiusY={ry}
              fill={fill} stroke={stroke} strokeWidth={d.strokeWidth} />
          </Group>
        )
      }

      case 'image':
        return <ImageElement key={el.id} el={el} commonProps={cp} />
      default: return null
    }
  }

  const editingEl = editingId ? elements.find((e) => e.id === editingId) : null

  return (
    <div className="relative w-full h-full" style={{ background: '#ffffff', overflow: 'hidden' }}>
      <Stage
        ref={stageRef}
        width={width} height={height}
        scaleX={stageScale} scaleY={stageScale}
        x={stagePos.x} y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        draggable={false}
        style={{ cursor: isSpacePan ? (isPanning.current ? 'grabbing' : 'grab') : tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair' }}
      >
        <Layer>
          {[...elements].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0)).map(renderElement)}
          {/* Seçilmiş elementlərin highlight-ı */}
          {selectedIds.length > 1 && elementsRef.current
            .filter((el) => selectedIds.includes(el.id))
            .map((el) => {
              const bb = getElBBox(el)
              return <Rect key={`sel-${el.id}`}
                x={bb.x - 4} y={bb.y - 4}
                width={bb.w + 8} height={bb.h + 8}
                fill="rgba(99,102,241,0.08)" stroke="#6366f1"
                strokeWidth={1.5 / stageScale} dash={[4/stageScale, 2/stageScale]}
                listening={false} />
            })
          }
          {/* Rubber band selection box */}
          {selBox && selBox.w > 2 && (
            <Rect
              x={selBox.x} y={selBox.y} width={selBox.w} height={selBox.h}
              fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth={1 / stageScale}
              dash={[4 / stageScale, 2 / stageScale]}
              listening={false}
            />
          )}
          <Transformer
            ref={transformerRef}
            rotateEnabled={true}
            enabledAnchors={['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center']}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
            ignoreStroke={true}
            shouldOverdrawWholeArea={true}
          />
        </Layer>
      </Stage>

      {editingId && editingEl && (
        <textarea
          ref={textareaRef}
          defaultValue={editingEl.data.text || ''}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { finishEditing(); return }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEditing() }
          }}
          style={{
            position: 'fixed', top: editPos.y, left: editPos.x,
            fontSize: (editingEl.data.fontSize ?? 20) * editPos.scale,
            fontFamily: editingEl.data.fontFamily ?? 'Arial',
            color: editingEl.data.fill ?? '#0f172a',
            background: 'rgba(255,255,255,0.97)', border: '2px solid #4f46e5',
            borderRadius: 4, padding: '2px 6px', outline: 'none',
            minWidth: 100, minHeight: 32, resize: 'both', lineHeight: 1.2,
            zIndex: 9999, boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
          }}
        />
      )}
    </div>
  )
})

export default CanvasBoard

function ImageElement({ el, commonProps }: { el: CanvasElement; commonProps: object }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const d = el.data
  useEffect(() => {
    if (!d.src) return
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = d.src
    img.onload  = () => setImage(img)
    img.onerror = () => console.error('Şəkil yüklənmədi:', d.src)
  }, [d.src])
  if (!image) return null
  return <KonvaImage {...commonProps} x={d.x} y={d.y} width={d.width} height={d.height} image={image} rotation={d.rotation} />
}
