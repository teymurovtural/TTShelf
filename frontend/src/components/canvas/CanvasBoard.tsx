import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import Konva from 'konva'
import {
  Stage, Layer, Rect, Arrow, Image as KonvaImage,
  Line, Transformer, RegularPolygon, Star as KonvaStar, Ellipse, Group, Path,
} from 'react-konva'
import { useCanvasStore } from '../../store/canvasStore'
import { uploadApi } from '../../api/upload'
import type { CanvasElement, ElementData, TextRun } from '../../types'
import { v4 as uuidv4 } from 'uuid'
import RichTextShape, { isAreaText, textBox } from './RichTextShape'
import RichTextEditor from './RichTextEditor'
import { getDefaults, getRuns, layoutText, runsToPlainText, type Align } from './richText'

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
    addElement, updateElement, deleteSelected, deleteElement,
    setSelectedId, setSelectedIds, setTool, pushHistory,
  } = useCanvasStore()

  const stageRef       = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
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
  const [editPos,    setEditPos]    = useState({ x: 0, y: 0, scale: 1, areaW: undefined as number|undefined, areaH: undefined as number|undefined })
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

    if (selectedIds.length >= 1 && !editingId) {
      const nodes = selectedIds
        .map((sid) => stage.findOne(`#${sid}`))
        .filter(Boolean) as Konva.Node[]
      if (nodes.length > 0) {
        const px = stage.x(); const py = stage.y()
        const sx = stage.scaleX(); const sy = stage.scaleY()
        tr.nodes(nodes)
        stage.x(px); stage.y(py)
        stage.scaleX(sx); stage.scaleY(sy)
        stage.batchDraw()
        return
      }
    }
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
      const target = e.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (target.isContentEditable) return       // mətn redaktəsi gedir
      if (editingId) return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deleteSelected, editingId])

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

  // ── Mətn redaktəsi (rich text) ──
  // Redaktə overlay-nin ekran mövqeyini/miqyasını hesablayır — həm redaktəyə
  // başlayanda, həm də redaktə zamanı pan/zoom baş verəndə çağırılır ki,
  // üzən qutu canvas-dakı fiqurdan "ayrılmasın".
  const computeEditPos = (elId: string) => {
    const el = elementsRef.current.find((e) => e.id === elId)
    if (!el || el.type !== 'text') return null
    const stage = stageRef.current
    if (!stage) return null
    const node = stage.findOne(`#${el.id}`)
    if (!node) return null
    const stageBox = stage.container().getBoundingClientRect()
    const absPos   = node.getAbsolutePosition()
    const sc       = stageScaleRef.current
    const area     = isAreaText(el)
    const box      = textBox(el)
    return {
      x: stageBox.left + absPos.x,
      y: stageBox.top  + absPos.y,
      scale: sc,
      areaW: area ? box.width  * sc : undefined,
      areaH: area ? box.height * sc : undefined,
    }
  }

  const startEditing = (elId: string) => {
    const pos = computeEditPos(elId)
    if (!pos) return
    setEditingId(elId)
    setEditPos(pos)
    transformerRef.current?.hide()
    transformerRef.current?.getLayer()?.batchDraw()
  }

  // Redaktə açıqkən stage pan/zoom olanda overlay-i canlı sinxronlaşdır
  useEffect(() => {
    if (!editingId) return
    const pos = computeEditPos(editingId)
    if (pos) setEditPos(pos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, stagePos, stageScale])

  const handleRunsChange = (id: string, runs: TextRun[]) => {
    updateElement(id, { runs, text: runsToPlainText(runs) })
  }

  const finishEditing = () => {
    if (!editingId) return
    const id = editingId
    setEditingId(null)
    transformerRef.current?.show()
    transformerRef.current?.getLayer()?.batchDraw()

    const el = elementsRef.current.find((e) => e.id === id)
    // Tamamilə boş qalan mətn elementi canvas-da qalmasın
    if (el && !runsToPlainText(getRuns(el.data)).trim()) {
      deleteElement(id)
      return
    }
    pushHistory()
    setSelectedIds([id])
  }

  const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (isSpaceDown.current) return
    if (editingId) { finishEditing(); return }

    // Pan aləti — stage-i birbaşa sürüşdür
    if (tool === 'pan') {
      isPanning.current  = true
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      return
    }

    // Text aləti aktiv olanda mövcud text elementinə klikləndikdə — düzəliş et
    if (tool === 'text' && e.target !== stageRef.current && e.target.getType() !== 'Stage') {
      const clickedId = e.target.id() || e.target.getParent()?.id()
      const clickedEl = clickedId ? elementsRef.current.find((el) => el.id === clickedId) : null
      if (clickedEl && clickedEl.type === 'text') {
        e.cancelBubble = true
        setTool('select')
        setSelectedIds([clickedEl.id])
        setTimeout(() => startEditing(clickedEl.id), 30)
        return
      }
    }



    const pos      = getPointerOnStage()
    const isStage = e.target === stageRef.current || e.target.getType() === 'Stage'

    if (tool === 'select') {
      if (isStage) {
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
      // Text tool: mouseDown-da yalnız başlanğıc nöqtəni saxla
      // mouseUp-da ölçüyə görə area və ya klik text yaradılır
      isDrawing.current = true
      drawingId.current = id
      data = {
        x: pos.x, y: pos.y, width: 0, height: 0,
        ...SHAPE_DEFAULTS.text,
        text: '', runs: [{ text: '' }], autoWidth: true,
        align: 'left', lineHeight: 1.2, letterSpacing: 0,
      }
    }

    addElement({ id, canvas_id: '', type: tool, data, z_index: elements.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
  }

  const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // Pan aləti — stage sürüşdür
    if (tool === 'pan' && isPanning.current) {
      const dx = e.evt.clientX - lastPanPos.current.x
      const dy = e.evt.clientY - lastPanPos.current.y
      lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
      const newPos = { x: stagePosRef.current.x + dx, y: stagePosRef.current.y + dy }
      stagePosRef.current = newPos
      setStagePos({ ...newPos })
      return
    }

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

    if (tool === 'text') {
      const w = pos.x - (el.data.x || 0)
      const h = pos.y - (el.data.y || 0)
      // Sürükləmə 10px-i keçən kimi area rejiminə keç ki, qutunun sərhədi
      // dartılan ölçüyə canlı uyğunlaşsın (əks halda mouseup-a qədər görünmürdü)
      const isArea = Math.abs(w) > 10 && Math.abs(h) > 10
      updateElement(drawingId.current, { width: w, height: h, autoWidth: !isArea })
    } else if (['rect','circle','diamond','parallelogram','cross','cylinder'].includes(tool)) {
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
    if (tool === 'pan') { isPanning.current = false; return }
    // Rubber band bitdi — içindəki elementləri seç
    if (selStart.current) {
      const currentBox = selBoxRef.current
      if (currentBox && currentBox.w > 5 && currentBox.h > 5) {
        const { x, y, w, h } = currentBox
        const inside = elementsRef.current.filter((el) => {
          const bb = getElBBox(el)
          // Tam içəridə deyil, toxunsa da seç (intersects)
          return bb.x < x + w && bb.x + bb.w > x &&
                 bb.y < y + h && bb.y + bb.h > y
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

    // Text tool: area > 10px olarsa area text, kiçik olarsa klik text
    const currentEl = elementsRef.current.find((e) => e.id === drawingId.current)
    if (currentEl && currentEl.type === 'text') {
      const id = drawingId.current
      const rawW = currentEl.data.width ?? 0
      const rawH = currentEl.data.height ?? 0
      const w = Math.abs(rawW)
      const h = Math.abs(rawH)
      if (w > 10 && h > 10) {
        // Area mətn — mənfi istiqamətdə çəkiləni normallaşdır
        updateElement(id, {
          x: (currentEl.data.x ?? 0) + Math.min(rawW, 0),
          y: (currentEl.data.y ?? 0) + Math.min(rawH, 0),
          width: w, height: h, autoWidth: false,
        })
      } else {
        // Nöqtə mətni — en/hündürlük avtomatik
        updateElement(id, { width: 0, height: 0, autoWidth: true })
      }
      drawingId.current = null
      setTool('select')
      setSelectedIds([id])
      setTimeout(() => startEditing(id), 50)
      return
    }

    const newId = drawingId.current
    drawingId.current = null
    setTool('select')
    setSelectedIds([newId])
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
    if (el.type === 'text') {
      const b = textBox(el)
      return { x: d.x ?? 0, y: d.y ?? 0, w: b.width, h: b.height }
    }
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

  // Verilmiş enə görə mətnin daxildə tutduğu real hündürlük — qutu bundan aşağı kiçilməsin
  const minTextAreaHeight = (el: CanvasElement, boxWidth: number) => {
    const d = el.data as any
    const defaults = getDefaults(d)
    const layout = layoutText({
      runs: getRuns(d),
      defaults,
      boxWidth: Math.max(boxWidth, 1),
      align: (d.align ?? 'left') as Align,
      lineHeight: d.lineHeight ?? 1.2,
      letterSpacing: d.letterSpacing ?? 0,
    })
    return Math.max(layout.height, defaults.fontSize)
  }

  // Mətn qutusu dartılanda hərflər deformasiya olmasın —
  // scale-i dərhal 1-ə qaytarıb en/hündürlüyü dəyişirik, mətn yenidən axır (Illustrator area type)
  const handleTextTransform = (id: string, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target as Konva.Group
    const sx = node.scaleX()
    const sy = node.scaleY()
    if (sx === 1 && sy === 1) return
    const el = elementsRef.current.find((el) => el.id === id)
    const w = Math.max(24, node.width()  * sx)
    const minH = el ? minTextAreaHeight(el, w) : 16
    const h = Math.max(minH, node.height() * sy)
    node.scaleX(1); node.scaleY(1)
    node.width(w);  node.height(h)
    updateElement(id, {
      x: node.x(), y: node.y(),
      width: w, height: h,
      rotation: node.rotation(),
      autoWidth: false,
      scaleX: 1, scaleY: 1,
    })
  }

  const handleTextTransformEnd = (id: string, e: Konva.KonvaEventObject<Event>) => {
    handleTextTransform(id, e)
    const node = e.target as Konva.Group
    node.scaleX(1); node.scaleY(1)
    updateElement(id, {
      x: node.x(), y: node.y(),
      width: node.width(), height: node.height(),
      rotation: node.rotation(), autoWidth: false, scaleX: 1, scaleY: 1,
    })
    pushHistory()
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

    const isPathShape = ['triangle','pentagon','hexagon','star','cross','parallelogram','cylinder','diamond'].includes(el.type)

    if (isPathShape) {
      const sx   = node.scaleX(); const sy = node.scaleY()
      const oldW = Math.abs(el.data.width  ?? 0)
      const oldH = Math.abs(el.data.height ?? 0)
      updateElement(id, {
        x: node.x(), y: node.y(),
        width:    oldW * Math.abs(sx),
        height:   oldH * Math.abs(sy),
        rotation: node.rotation(),
        scaleX: 1, scaleY: 1,
      })
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
      if (el.type === 'text') startEditing(el.id)
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
        return (
          <RichTextShape
            key={el.id}
            el={el}
            draggable={tool === 'select' && editingId !== el.id}
            selected={selectedIds.includes(el.id)}
            editing={editingId === el.id}
            onSelect={(e) => { e.cancelBubble = true; handleElementClick(el, e) }}
            onDblClick={(e) => { e.cancelBubble = true; startEditing(el.id) }}
            onDragStart={() => handleDragStart(el.id)}
            onDragEnd={(e) => handleDragEnd(el.id, e)}
            onTransform={(e) => handleTextTransform(el.id, e)}
            onTransformEnd={(e) => handleTextTransformEnd(el.id, e)}
          />
        )

      case 'triangle':
      case 'pentagon':
      case 'hexagon': {
        const sides  = el.type === 'triangle' ? 3 : el.type === 'pentagon' ? 5 : 6
        const w = Math.abs(d.width ?? 0); const h = Math.abs(d.height ?? 0)
        const cr = (d.cornerRadius as any) ?? 0
        const rx = w / 2; const ry = h / 2
        const pts: number[][] = []
        for (let i = 0; i < sides; i++) {
          const angle = (Math.PI * 2 * i / sides) - Math.PI / 2
          pts.push([rx + rx * Math.cos(angle), ry + ry * Math.sin(angle)])
        }
        const pathData = roundedPolygonPath(pts, cr)
        return <Path key={el.id} {...cp}
          x={d.x ?? 0} y={d.y ?? 0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={d.rotation ?? 0}
          hitFunc={(ctx: any, shape: any) => {
            ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.closePath()
            ctx.fillStrokeShape(shape)
          }} />
      }

      case 'star': {
        const w = Math.abs(d.width ?? 0); const h = Math.abs(d.height ?? 0)
        const cr = (d.cornerRadius as any) ?? 0
        const outerRx = w / 2; const outerRy = h / 2
        const innerRx = outerRx * 0.45; const innerRy = outerRy * 0.45
        const pts: number[][] = []
        for (let i = 0; i < 10; i++) {
          const angle = (Math.PI * i / 5) - Math.PI / 2
          const rx = i % 2 === 0 ? outerRx : innerRx
          const ry = i % 2 === 0 ? outerRy : innerRy
          pts.push([outerRx + rx * Math.cos(angle), outerRy + ry * Math.sin(angle)])
        }
        const pathData = roundedPolygonPath(pts, cr)
        return <Path key={el.id} {...cp}
          x={d.x ?? 0} y={d.y ?? 0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={d.rotation ?? 0}
          hitFunc={(ctx: any, shape: any) => {
            ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.closePath()
            ctx.fillStrokeShape(shape)
          }} />
      }

      case 'diamond': {
        const w = Math.abs(d.width ?? 0); const h = Math.abs(d.height ?? 0)
        const pathData = `M ${w/2} 0 L ${w} ${h/2} L ${w/2} ${h} L 0 ${h/2} Z`
        return <Path key={el.id} {...cp}
          x={d.x ?? 0} y={d.y ?? 0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={d.rotation ?? 0}
          hitFunc={(ctx: any, shape: any) => {
            ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.closePath()
            ctx.fillStrokeShape(shape)
          }} />
      }

      case 'parallelogram': {
        const pw = Math.abs(d.width ?? 0); const ph = Math.abs(d.height ?? 0)
        const skew = pw * 0.25
        const pathData = `M ${skew} 0 L ${pw} 0 L ${pw - skew} ${ph} L 0 ${ph} Z`
        return <Path key={el.id} {...cp}
          x={d.x ?? 0} y={d.y ?? 0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={d.rotation ?? 0}
          hitFunc={(ctx: any, shape: any) => {
            ctx.beginPath(); ctx.rect(0, 0, pw, ph); ctx.closePath()
            ctx.fillStrokeShape(shape)
          }} />
      }

      case 'cross': {
        const cw = Math.abs(d.width??0); const ch = Math.abs(d.height??0)
        const t = cw/3; const t2 = ch/3
        const cr = (d.cornerRadius as any) ?? 0
        const crossPts = [
          [t, 0], [cw-t, 0], [cw-t, t2], [cw, t2],
          [cw, ch-t2], [cw-t, ch-t2], [cw-t, ch], [t, ch],
          [t, ch-t2], [0, ch-t2], [0, t2], [t, t2],
        ]
        const pathData = roundedPolygonPath(crossPts, cr)
        return <Path key={el.id} {...cp}
          x={d.x??0} y={d.y??0}
          data={pathData}
          fill={d.fill==='transparent'?undefined:d.fill}
          stroke={d.stroke==='transparent'?undefined:d.stroke}
          strokeWidth={d.strokeWidth} rotation={d.rotation ?? 0}
          hitFunc={(ctx: any, shape: any) => {
            ctx.beginPath(); ctx.rect(0, 0, cw, ch); ctx.closePath()
            ctx.fillStrokeShape(shape)
          }} />
      }

      case 'cylinder': {
        const cyW = Math.abs(d.width??0); const cyH = Math.abs(d.height??0)
        const ry = Math.max(cyH * 0.15, 8)
        const fill = d.fill==='transparent'?undefined:d.fill
        const stroke = d.stroke==='transparent'?undefined:d.stroke
        return (
          <Group key={el.id} {...cp} x={d.x??0} y={d.y??0} width={cyW} height={cyH}>
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
            rotateEnabled={selectedIds.length === 1}
            enabledAnchors={selectedIds.length === 1
              ? ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center']
              : []
            }
            keepRatio={false}
            boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
            ignoreStroke={true}
            shouldOverdrawWholeArea={false}
          />
        </Layer>
      </Stage>

      {editingId && editingEl && (
        <RichTextEditor
          key={editingId}
          el={editingEl}
          left={editPos.x}
          top={editPos.y}
          scale={editPos.scale}
          areaW={editPos.areaW}
          areaH={editPos.areaH}
          onChange={(runs) => handleRunsChange(editingId, runs)}
          onFinish={finishEditing}
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
