import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, startTransition, forwardRef, useImperativeHandle } from 'react'
import Konva from 'konva'
import {
  Stage, Layer, Rect, Arrow, Image as KonvaImage,
  Line, Transformer, Ellipse, Group, Path,
} from 'react-konva'
import { useCanvasStore } from '../../store/canvasStore'
import { usePageStore } from '../../store/pageStore'
import { uploadApi } from '../../api/upload'
import { pagesApi } from '../../api/pages'
import type { CanvasElement, ElementData, TextRun } from '../../types'
import { v4 as uuidv4 } from 'uuid'
import RichTextShape, { isAreaText, textBox } from './RichTextShape'
import RichTextEditor from './RichTextEditor'
import { getDefaults, getRuns, layoutText, runsToPlainText, type Align } from './richText'

// ---- Rounded polygon path helpers ----
// ---- Sloppiness: xətt nöqtələrinə deterministik offset əlavə edir ----
// seed-based pseudorandom — hər render eyni nəticə verir (element id-dən)
function seededRand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}


function applySloppinessPath(pathData: string, sloppiness: number, id: string): string {
  if (!sloppiness || sloppiness === 0) return pathData
  const amplitude = sloppiness === 1 ? 3 : 8
  const seed = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const rand = seededRand(seed)
  // Yalnız koordinat rəqəmlərini jitter et
  return pathData.replace(/(-?\d+\.?\d*)/g, (match) => {
    const f = parseFloat(match)
    if (isNaN(f)) return match
    return String(f + (rand() - 0.5) * amplitude * 2)
  })
}

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

// ---- End helpers ----

// ElementData-nın canvas-a məxsus genişləndirilmiş tipi
type ExtendedData = {
  sloppiness?: number
  cornerRadius?: number | number[]
  [key: string]: unknown
}

// cornerRadius-u path funksiyaları üçün number-ə normalize et
function normCr(cr: number | number[] | undefined): number {
  if (Array.isArray(cr)) return typeof cr[0] === 'number' ? cr[0] : 0
  return cr ?? 0
}

// Komponent xaricindəki tip və helper-lər
type ShapeProps = {
  id: string
  draggable: boolean
  opacity: number
  listening: boolean
  onClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: () => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
}

// Rect/Circle üçün ortaq prop helper
type RectLikeData = { fill?: string; stroke?: string; strokeWidth?: number; width?: number; height?: number; rotation?: number; dash?: number[] }
function sharedRectProps(d: RectLikeData) {
  return {
    offsetX:     d.width  && d.width  < 0 ? Math.abs(d.width)  : 0,
    offsetY:     d.height && d.height < 0 ? Math.abs(d.height) : 0,
    fill:        d.fill   === 'transparent' ? undefined : d.fill,
    stroke:      d.stroke === 'transparent' ? undefined : d.stroke,
    strokeWidth: d.strokeWidth,
    rotation:    d.rotation,
    dash:        d.dash,
  }
}

// Path shape-lər üçün ortaq hit area — AABB rect (toxunma dəqiqliyi üçün)
function makeRectHitFunc(w: number, h: number) {
  return (ctx: Konva.Context, shape: Konva.Shape) => {
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.closePath()
    ctx.fillStrokeShape(shape)
  }
}

// Sloppiness üçün ortaq helper — line və arrow hər ikisi istifadə edir
function buildSloppyPts(
    x0: number, y0: number, x1: number, y1: number,
    slop: number, elId: string
): number[] {
  const dx = x1-x0, dy = y1-y0
  const dist = Math.hypot(dx, dy) || 1
  const px = -dy/dist, py = dx/dist
  const len = dist
  const seed = elId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const rnd = seededRand(seed)

  if (slop === 1) {
    const amp = len * 0.18
    const sign = rnd() > 0.5 ? 1 : -1
    return [
      x0, y0,
      x0 + dx*0.25 + px*amp*sign,  y0 + dy*0.25 + py*amp*sign,
      x0 + dx*0.75 + px*amp*(-sign), y0 + dy*0.75 + py*amp*(-sign),
      x1, y1,
    ]
  }
  // slop === 2
  const amp = len * 0.28
  const sign = rnd() > 0.5 ? 1 : -1
  return [
    x0, y0,
    x0 + dx*0.2  + px*amp*sign,       y0 + dy*0.2  + py*amp*sign,
    x0 + dx*0.45 + px*amp*(-sign)*0.7, y0 + dy*0.45 + py*amp*(-sign)*0.7,
    x0 + dx*0.65 + px*amp*sign*0.8,   y0 + dy*0.65 + py*amp*sign*0.8,
    x0 + dx*0.85 + px*amp*(-sign)*0.5, y0 + dy*0.85 + py*amp*(-sign)*0.5,
    x1, y1,
  ]
}


// Element bounding box — komponent xaricindədir, eraseAtPoint və handleDragEnd istifadə edir
function getElBBox(el: CanvasElement) {
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
    const pad = el.type === 'freehand'
        ? (d.strokeWidth as number ?? 2) / 2 + 8
        : (d.strokeWidth as number ?? 2) / 2 + 20
    return { x: minX - pad, y: minY - pad, w: Math.max(maxX - minX, pad * 2), h: Math.max(maxY - minY, pad * 2) }
  }
  if (isCentered) {
    const r = Math.abs(d.width ?? 0) / 2
    return { x: (d.x ?? 0) - r, y: (d.y ?? 0) - r, w: r * 2, h: r * 2 }
  }
  if (el.type === 'cylinder') {
    return { x: d.x ?? 0, y: d.y ?? 0, w: Math.abs(d.width ?? 0), h: Math.abs(d.height ?? 0) }
  }
  return { x: d.x ?? 0, y: d.y ?? 0, w: Math.abs(d.width ?? 0), h: Math.abs(d.height ?? 0) }
}

// Arrow/Line üçün əyri yoxlama helper
function checkBend(pts: number[]): boolean {
  if (pts.length < 6) return false
  const mx = (pts[0] + pts[4]) / 2
  const my = (pts[1] + pts[5]) / 2
  return Math.abs(pts[2] - mx) > 5 || Math.abs(pts[3] - my) > 5
}

// A4 ölçüləri @ 96 dpi
export const A4_W_PT = 794
export const A4_H_PT = 1123

// Çox-səhifəli grid: 3 sütun, hər A4 arasında GAP boşluq (canvas koordinatında)
export const GRID_COLS = 3
export const GRID_PAGE_GAP = 40

interface CanvasBoardProps { width: number; height: number; canvasId: string }
export interface CanvasBoardHandle {
  exportImage: () => string | null
  exportAllPages: () => Promise<Array<{ dataUrl: string; w: number; h: number }>>
  // Stage-in görünən mərkəzini stage koordinatında qaytarır (image drop üçün)
  getViewCenter: () => { x: number; y: number }
}

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
    function CanvasBoard({ width, height, canvasId }, ref) {

      const {
        elements, tool, selectedIds,
        addElement, updateElement, deleteSelected, deleteElement,
        setSelectedIds, setTool, pushHistory,
        eraserSize, setElementPageId,
      } = useCanvasStore()

      // Aktiv page-in orientasiyasına görə A4 ölçüsü
      const { pages, activePageId, switchPage, createPage, deletePage } = usePageStore()
      const activePage = pages.find(p => p.id === activePageId)
      const isLandscape = activePage?.orientation === 'landscape'
      const A4_W = isLandscape ? A4_H_PT : A4_W_PT
      const A4_H = isLandscape ? A4_W_PT : A4_H_PT

      // Verilmiş canvas koordinatı hansı page-in A4 sahəsinin üstündədirsə,
      // onun id-sini qaytarır. Heç birinin üstündə deyilsə undefined.
      // Sürüklənən elementin son mövqeyinə görə page_id-ni doğru təyin etmək üçün istifadə olunur —
      // əvvəllər element hara sürüklənirsə sürüklənsin, yaradıldığı (activePageId) page-ə "yapışıb" qalırdı.
      const getPageIdAtPoint = useCallback((x: number, y: number): string | undefined => {
        for (let i = pages.length - 1; i >= 0; i--) {
          const page = pages[i]
          const col = i % GRID_COLS
          const row = Math.floor(i / GRID_COLS)
          const ppos = { x: col * (A4_W_PT + GRID_PAGE_GAP), y: row * (A4_H_PT + GRID_PAGE_GAP) }
          const size = {
            w: page.orientation === 'landscape' ? A4_H_PT : A4_W_PT,
            h: page.orientation === 'landscape' ? A4_W_PT : A4_H_PT,
          }
          if (x >= ppos.x && x <= ppos.x + size.w && y >= ppos.y && y <= ppos.y + size.h) {
            return page.id
          }
        }
        return undefined
      }, [pages])

      const stageRef       = useRef<Konva.Stage>(null)
      const transformerRef = useRef<Konva.Transformer>(null)
      const onTransformerMount = useCallback((node: Konva.Transformer | null) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(transformerRef as any).current = node
      }, [])
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

      // A4-ü ekrana fit et — ilk yükləmədə və orientation dəyişəndə
      const [editingId,  setEditingId]  = useState<string | null>(null)
      const [editPos,    setEditPos]    = useState({ x: 0, y: 0, scale: 1, areaW: undefined as number|undefined, areaH: undefined as number|undefined })
      const [isSpacePan,  setIsSpacePan]  = useState(false)
      const [isDragging,  setIsDragging]  = useState(false)

      // Rubber band selection state
      const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
      const selBoxRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
      const selStart  = useRef<{ x: number; y: number } | null>(null)

      // Eraser
      const isEraserDown  = useRef(false)
      const [eraserPos, setEraserPos] = useState<{ x: number; y: number } | null>(null)

      useEffect(() => { stagePosRef.current = stagePos },   [stagePos])
      useEffect(() => { stageScaleRef.current = stageScale }, [stageScale])
      useEffect(() => { elementsRef.current = elements },     [elements])

      // İlk yükləmə — tək A4-ü mərkəzdə fit et
      const initialFitDone = useRef(false)
      useLayoutEffect(() => {
        if (width > 0 && height > 0 && !initialFitDone.current) {
          initialFitDone.current = true
          const padding = 60
          const scaleX = (width  - padding * 2) / A4_W_PT
          const scaleY = (height - padding * 2) / A4_H_PT
          const scale  = Math.min(scaleX, scaleY, 1.2)   // max 120% — çox böyük olmasın
          const x = (width  - A4_W_PT * scale) / 2
          const y = (height - A4_H_PT * scale) / 2
          stagePosRef.current   = { x, y }
          stageScaleRef.current = scale
          startTransition(() => {
            setStageScale(scale)
            setStagePos({ x, y })
          })
        }
      }, [width, height])

      // Export — yalnız A4 sahəsini çıxar
      useImperativeHandle(ref, () => ({
        // Stage-in görünən mərkəzini stage koordinatında qaytarır
        // Məntiq: ekran mərkəzi → stage koordinatına çevir
        getViewCenter: () => {
          const stage = stageRef.current
          if (!stage) return { x: 400, y: 400 }
          const cx = width  / 2
          const cy = height / 2
          return {
            x: (cx - stagePosRef.current.x) / stageScaleRef.current,
            y: (cy - stagePosRef.current.y) / stageScaleRef.current,
          }
        },

        exportImage: () => {
          if (!stageRef.current) return null
          const tr = transformerRef.current
          tr?.hide(); stageRef.current.batchDraw()
          const dataUrl = stageRef.current.toDataURL({
            pixelRatio: 2,
            mimeType: 'image/png',
            x: 0,
            y: 0,
            width:  A4_W,
            height: A4_H,
          })
          tr?.show(); stageRef.current.batchDraw()
          return dataUrl
        },

        // Bütün page-ləri off-screen Konva stage-də render edib PNG array qaytarır
        exportAllPages: async () => {
          const results: Array<{ dataUrl: string; w: number; h: number }> = []

          const COLS = GRID_COLS
          const PAGE_GAP = GRID_PAGE_GAP

          // Render zamanı ilə eyni offset hesabı — hər page öz ölçüsünü nəzərə alır
          // pagePositions[i] = render-dəki pagePositions ilə eyni olmalıdır
          // Render: col * (A4_W_PT + GAP), row * (A4_H_PT + GAP) — portrait bazasında
          // (landscape olsa da render eyni formuldan istifadə edir)
          const getExportOffset = (idx: number) => {
            const col = idx % COLS
            const row = Math.floor(idx / COLS)
            return {
              x: col * (A4_W_PT + PAGE_GAP),
              y: row * (A4_H_PT + PAGE_GAP),
            }
          }

          for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
            const page = pages[pageIdx]
            const isLand = page.orientation === 'landscape'
            const pw = isLand ? A4_H_PT : A4_W_PT
            const ph = isLand ? A4_W_PT : A4_H_PT

            // Bu page-in canvas-dakı offset-i (render ilə eyni formula)
            const { x: offsetX, y: offsetY } = getExportOffset(pageIdx)

            // canvasStore-dan bu page-ə aid elementləri götür
            const allEls = useCanvasStore.getState().elements
            const pageEls = allEls.filter(el => el.page_id === page.id)

            // Off-screen container
            const container = document.createElement('div')
            container.style.cssText = 'position:absolute;left:-99999px;top:-99999px;width:0;height:0;overflow:hidden'
            document.body.appendChild(container)

            const offStage = new Konva.Stage({
              container,
              width: pw,
              height: ph,
            })
            const layer = new Konva.Layer()
            offStage.add(layer)

            // Ağ A4 fonu
            layer.add(new Konva.Rect({ x: 0, y: 0, width: pw, height: ph, fill: '#ffffff' }))

            const sorted = [...pageEls].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0))

            for (const el of sorted) {
              const d = el.data as Record<string, unknown>
              const baseAttrs = {
                x:        ((d.x as number) ?? 0) - offsetX,
                y:        ((d.y as number) ?? 0) - offsetY,
                rotation: (d.rotation as number) ?? 0,
                opacity:  (d.opacity as number) ?? 1,
              }

              if (el.type === 'rect' || el.type === 'circle') {
                const cr = (d.cornerRadius as number) ?? (el.type === 'circle' ? 99999 : 0)
                layer.add(new Konva.Rect({
                  ...baseAttrs,
                  width:        Math.abs((d.width as number) ?? 0),
                  height:       Math.abs((d.height as number) ?? 0),
                  fill:         (d.fill as string) ?? 'transparent',
                  stroke:       (d.stroke as string) ?? 'transparent',
                  strokeWidth:  (d.strokeWidth as number) ?? 1,
                  dash:         (d.dash as number[]) ?? [],
                  cornerRadius: cr,
                }))
              } else if (el.type === 'line' || el.type === 'freehand') {
                const rawPts = (d.points as number[]) ?? []
                const adjPts = rawPts.map((v, i) => i % 2 === 0 ? v - offsetX : v - offsetY)
                layer.add(new Konva.Line({
                  x: 0, y: 0, rotation: (d.rotation as number) ?? 0, opacity: (d.opacity as number) ?? 1,
                  points:      adjPts,
                  stroke:      (d.stroke as string) ?? '#374151',
                  strokeWidth: (d.strokeWidth as number) ?? 2,
                  tension:     0.5,
                  lineCap:     'round',
                  lineJoin:    'round',
                  dash:        (d.dash as number[]) ?? [],
                }))
              } else if (el.type === 'arrow') {
                const rawArrPts = (d.points as number[]) ?? []
                const adjArrPts = rawArrPts.map((v, i) => i % 2 === 0 ? v - offsetX : v - offsetY)
                layer.add(new Konva.Arrow({
                  x: 0, y: 0, rotation: (d.rotation as number) ?? 0, opacity: (d.opacity as number) ?? 1,
                  points:        adjArrPts,
                  stroke:        (d.stroke as string) ?? '#6d28d9',
                  strokeWidth:   (d.strokeWidth as number) ?? 2,
                  fill:          (d.stroke as string) ?? '#6d28d9',
                  pointerLength: Math.max(12, ((d.strokeWidth as number) ?? 2) * 5),
                  pointerWidth:  Math.max(10, ((d.strokeWidth as number) ?? 2) * 4),
                  tension:       0,
                  lineCap:       'round',
                  lineJoin:      'round',
                  dash:          (d.dash as number[]) ?? [],
                }))
              } else if (el.type === 'triangle' || el.type === 'pentagon' || el.type === 'hexagon' ||
                  el.type === 'star' || el.type === 'diamond' || el.type === 'parallelogram' ||
                  el.type === 'cross' || el.type === 'cylinder') {
                // Path shape-lər: fill + stroke rectangle kimi fallback
                layer.add(new Konva.Rect({
                  ...baseAttrs,
                  width:       Math.abs((d.width as number) ?? 0),
                  height:      Math.abs((d.height as number) ?? 0),
                  fill:        (d.fill as string) ?? 'transparent',
                  stroke:      (d.stroke as string) ?? 'transparent',
                  strokeWidth: (d.strokeWidth as number) ?? 1,
                }))
              } else if (el.type === 'text') {
                // Rich text: runs-lardan plain text çıxar, Konva.Text ilə render et
                const runs = (d.runs as unknown[]) ?? []
                type RunLike = { text?: string; fontSize?: number; bold?: boolean; italic?: boolean; color?: string; fontFamily?: string }
                let plainText = ''
                let firstFontSize = (d.fontSize as number) ?? 20
                let firstColor = (d.fill as string) ?? '#0f172a'
                let firstFont = (d.fontFamily as string) ?? 'Arial'
                if (runs.length > 0) {
                  const r0 = runs[0] as RunLike
                  firstFontSize = r0.fontSize ?? firstFontSize
                  firstColor = r0.color ?? firstColor
                  firstFont = r0.fontFamily ?? firstFont
                  plainText = (runs as RunLike[]).map(r => r.text ?? '').join('')
                } else {
                  plainText = (d.text as string) ?? ''
                }
                layer.add(new Konva.Text({
                  ...baseAttrs,
                  text:        plainText,
                  fontSize:    firstFontSize,
                  fontFamily:  firstFont,
                  fill:        firstColor,
                  width:       (d.width as number) ?? undefined,
                  wrap:        'word',
                  align:       (d.align as string) ?? 'left',
                }))
              } else if (el.type === 'image') {
                // Şəkil: fetch → blob URL → Image
                // crossOrigin='anonymous' + birbaşa URL CORS taint problemi yaradır.
                // fetch ilə yükləyib blob URL yaratmaq həm CORS-u həll edir,
                // həm də canvas.toDataURL()-nin "tainted canvas" xətasını önləyir.
                const src = (d.src as string) ?? ''
                if (src) {
                  await new Promise<void>(async (resolve) => {
                    try {
                      const response = await fetch(src, { mode: 'cors', credentials: 'omit' })
                      const blob = await response.blob()
                      const blobUrl = URL.createObjectURL(blob)
                      const img = new window.Image()
                      img.onload = () => {
                        layer.add(new Konva.Image({
                          ...baseAttrs,
                          image:  img,
                          width:  (d.width as number) ?? img.width,
                          height: (d.height as number) ?? img.height,
                        }))
                        URL.revokeObjectURL(blobUrl)
                        resolve()
                      }
                      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve() }
                      img.src = blobUrl
                    } catch {
                      // fetch uğursuz olsa crossOrigin ilə fallback cəhd et
                      const img = new window.Image()
                      img.crossOrigin = 'anonymous'
                      img.onload  = () => { layer.add(new Konva.Image({ ...baseAttrs, image: img, width: (d.width as number) ?? img.width, height: (d.height as number) ?? img.height })); resolve() }
                      img.onerror = () => resolve()
                      img.src = src
                    }
                  })
                }
              }
            }

            // Debug: page elementlərini log et
            console.log(`[Export] page[${pageIdx}] id=${page.id} offset=(${offsetX},${offsetY}) elements=${pageEls.length}`)
            pageEls.forEach(el => {
              const d = el.data as Record<string, unknown>
              console.log(`  el type=${el.type} x=${d.x} y=${d.y} → adjusted=(${(d.x as number ?? 0) - offsetX}, ${(d.y as number ?? 0) - offsetY})`)
            })

            // Konva render pipeline-ı tamamlasın deyə əvvəlcə draw() çağır,
            // sonra bir microtask gözlə — bu xüsusilə image elementlər üçün vacibdir
            layer.draw()
            await new Promise<void>(resolve => setTimeout(resolve, 0))

            const dataUrl = offStage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
            results.push({ dataUrl, w: pw, h: ph })

            offStage.destroy()
            document.body.removeChild(container)
          }

          return results
        },
      }), [pages, elements, A4_W, A4_H])

      // Transformer — YALNIZ tək element seçiləndə işlət
      // Çoxlu seçimdə Transformer.nodes([]) — viewport-u tərpətməsin
      useEffect(() => {
        const tr    = transformerRef.current
        const stage = stageRef.current
        if (!tr || !stage) return

        // Arrow/Line seçildiğində Transformer-i gizlət — handle-lar ayrı Layer-dədir
        const sel = selectedIds.length === 1
            ? elementsRef.current.find(e => e.id === selectedIds[0])
            : null
        if (sel && ['line','arrow'].includes(sel.type)) {
          tr.nodes([])
          tr.getLayer()?.batchDraw()
          return
        }

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
            setIsDragging(true)
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
        const onMouseUp = () => { isPanning.current = false; setIsDragging(false) }

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
                  // Şəkli stage-in görünən mərkəzinə yerləşdir
                  const cx = width  / 2
                  const cy = height / 2
                  const stageX = (cx - stagePosRef.current.x) / stageScaleRef.current
                  const stageY = (cy - stagePosRef.current.y) / stageScaleRef.current
                  const w = Math.min(img.width  / 2, 600)
                  const h = Math.min(img.height / 2, 600)
                  addElement({
                    id: uuidv4(), canvas_id: '', page_id: getPageIdAtPoint(stageX, stageY) ?? activePageId ?? '', type: 'image',
                    data: { x: stageX - w / 2, y: stageY - h / 2, width: w, height: h, src: url },
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
      }, [editingId, elements.length, addElement, activePageId, getPageIdAtPoint])

      // Zoom
      const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
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
      }, [])

      const getPointerOnStage = useCallback(() => {
        const stage = stageRef.current
        if (!stage) return { x: 0, y: 0 }
        const pos = stage.getPointerPosition()
        if (!pos) return { x: 0, y: 0 }
        return {
          x: (pos.x - stagePosRef.current.x) / stageScaleRef.current,
          y: (pos.y - stagePosRef.current.y) / stageScaleRef.current,
        }
      }, [])

      // ── Mətn redaktəsi (rich text) ──
      // Redaktə overlay-nin ekran mövqeyini/miqyasını hesablayır — həm redaktəyə
      // başlayanda, həm də redaktə zamanı pan/zoom baş verəndə çağırılır ki,
      // üzən qutu canvas-dakı fiqurdan "ayrılmasın".
      const computeEditPos = useCallback((elId: string) => {
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
      }, [])

      const startEditing = useCallback((elId: string) => {
        const pos = computeEditPos(elId)
        if (!pos) return
        setEditingId(elId)
        setEditPos(pos)
        transformerRef.current?.hide()
        transformerRef.current?.getLayer()?.batchDraw()
      }, [computeEditPos])

      // Redaktə açıqkən stage pan/zoom olanda overlay-i canlı sinxronlaşdır
      useEffect(() => {
        if (!editingId) return
        const pos = computeEditPos(editingId)
        if (pos) startTransition(() => setEditPos(pos))
      }, [editingId, stagePos, stageScale, computeEditPos])

      const handleRunsChange = (id: string, runs: TextRun[]) => {
        updateElement(id, { runs, text: runsToPlainText(runs) })
      }

      const finishEditing = useCallback(() => {
        if (!editingId) return
        const id = editingId
        setEditingId(null)
        transformerRef.current?.show()
        transformerRef.current?.getLayer()?.batchDraw()

        const el = elementsRef.current.find((e) => e.id === id)
        if (el && !runsToPlainText(getRuns(el.data)).trim()) {
          deleteElement(id)
          return
        }
        pushHistory()
        setSelectedIds([id])
      }, [editingId, deleteElement, pushHistory, setSelectedIds])

      // Eraser — kursora toxunan elementləri tap və sil
      const eraseAtPoint = useCallback((px: number, py: number) => {
        const R = eraserSize
        const toProcess = elementsRef.current.filter((el) => {
          if (el.type !== 'freehand') return false
          const bb = getElBBox(el)
          const nearX = Math.max(bb.x, Math.min(px, bb.x + bb.w))
          const nearY = Math.max(bb.y, Math.min(py, bb.y + bb.h))
          return Math.hypot(px - nearX, py - nearY) <= R
        })

        toProcess.forEach((el) => {
          const pts = el.data.points as number[] | undefined
          if (!pts || pts.length < 4) { deleteElement(el.id); return }

          // Nöqtələri dairə içi/xarici kimi qruplaşdır — ardıcıl xarici nöqtələr
          // ayrı seqmentlər olur (boşluq saxlanır)
          const segments: number[][] = []
          let current: number[] = []

          for (let i = 0; i < pts.length - 1; i += 2) {
            const inside = Math.hypot(pts[i] - px, pts[i + 1] - py) <= R
            if (inside) {
              // Dairə içindədir — cari seqmenti bitir
              if (current.length >= 4) segments.push(current)
              current = []
            } else {
              current.push(pts[i], pts[i + 1])
            }
          }
          if (current.length >= 4) segments.push(current)

          // Orijinal elementi sil
          deleteElement(el.id)

          // Hər seqmenti ayrı freehand kimi əlavə et
          segments.forEach((seg) => {
            addElement({
              id: uuidv4(),
              canvas_id: '',
              page_id: activePageId || '',
              type: 'freehand',
              data: { ...el.data, points: seg },
              z_index: el.z_index,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
          })
        })
      }, [eraserSize, deleteElement, addElement])

      const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (isSpaceDown.current) return
        if (editingId) { finishEditing(); return }

        // Eraser
        if (tool === 'eraser') {
          isEraserDown.current = true
          const pos = getPointerOnStage()
          setEraserPos(pos)
          eraseAtPoint(pos.x, pos.y)
          return
        }

        // Pan aləti — stage-i birbaşa sürüşdür
        if (tool === 'pan') {
          isPanning.current  = true
          setIsDragging(true)
          lastPanPos.current = { x: e.evt.clientX, y: e.evt.clientY }
          return
        }

        // Text aləti aktiv olanda mövcud text elementinə klikləndikdə — düzəliş et
        if (tool === 'text' && e.target.getType() !== 'Stage') {
          const clickedId = e.target.id() || e.target.getParent()?.id()
          const clickedEl = clickedId ? elements.find((el) => el.id === clickedId) : null
          if (clickedEl && clickedEl.type === 'text') {
            e.cancelBubble = true
            setTool('select')
            setSelectedIds([clickedEl.id])
            setTimeout(() => startEditing(clickedEl.id), 30)
            return
          }
        }



        const pos      = getPointerOnStage()
        const isStage = e.target.getType() === 'Stage'

        if (tool === 'select') {
          if (isStage) {
            setSelectedIds([])
            selStart.current = pos
            selBoxRef.current = { x: pos.x, y: pos.y, w: 0, h: 0 }
            setSelBox({ x: pos.x, y: pos.y, w: 0, h: 0 })

            // Heç bir page-in içindəyiksə activePageId-i sıfırla
            const insidePage = pages.some((page, idx) => {
              const ppos = pagePositions[idx]
              const size = getPageSize(page)
              return pos.x >= ppos.x && pos.x <= ppos.x + size.w &&
                  pos.y >= ppos.y && pos.y <= ppos.y + size.h
            })
            if (!insidePage) {
              usePageStore.getState().setActivePageId(null as unknown as string)
            }
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
          const defaults = ((SHAPE_DEFAULTS as unknown) as Record<string, Partial<typeof SHAPE_DEFAULTS.rect>>)[tool] ?? SHAPE_DEFAULTS.rect
          // Mərkəz koordinat sistemi — x/y mərkəzdir
          data = { x: pos.x, y: pos.y, width: 0, height: 0, ...defaults }
        } else if (['diamond','parallelogram','cross','cylinder'].includes(tool)) {
          const defaults = ((SHAPE_DEFAULTS as unknown) as Record<string, Partial<typeof SHAPE_DEFAULTS.rect>>)[tool] ?? SHAPE_DEFAULTS.rect
          data = { x: pos.x, y: pos.y, width: 0, height: 0, ...defaults }
        } else if (tool === 'line') {
          // 3 nöqtə: [x0,y0, mx,my, x1,y1] — orta nöqtə sürüklənərək əyilir
          data = { points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y], ...SHAPE_DEFAULTS.line }
        } else if (tool === 'arrow') {
          data = { points: [pos.x, pos.y, pos.x, pos.y, pos.x, pos.y], ...SHAPE_DEFAULTS.arrow }
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

        // activePageId null olanda element əlavə etmə — əvvəlcə bir page seçilməlidir
        if (!activePageId) {
          // Birinci page-i avtomatik aktiv et
          if (pages.length > 0) {
            switchPage(canvasId, pages[0].id)
          }
          return
        }

        addElement({ id, canvas_id: '', page_id: getPageIdAtPoint(pos.x, pos.y) ?? activePageId, type: tool, data, z_index: elements.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
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

        // Eraser mousemove
        if (tool === 'eraser') {
          setEraserPos(pos)
          if (isEraserDown.current) eraseAtPoint(pos.x, pos.y)
          return
        }

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
          // Çəkmə zamanı həmişə autoWidth:false — kənar xətt görünsün
          updateElement(drawingId.current, { width: w, height: h, autoWidth: false })
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
          const radius = Math.max(Math.abs(pos.x - (el.data.x || 0)), Math.abs(pos.y - (el.data.y || 0)))
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
          // 3 nöqtə: başlanğıc, orta (avtomatik), son
          const mx = (pts[0] + ex) / 2
          const my = (pts[1] + ey) / 2
          updateElement(drawingId.current, { points: [pts[0], pts[1], mx, my, ex, ey] })
        } else if (tool === 'freehand') {
          updateElement(drawingId.current, { points: [...(el.data.points || []), pos.x, pos.y] })
        }
      }

      const handleMouseLeave = useCallback(() => {
        isEraserDown.current = false
        setEraserPos(null)
      }, [])

      const handleMouseUp = () => {
        if (tool === 'eraser') {
          isEraserDown.current = false
          if (elementsRef.current.length !== elements.length) pushHistory()
          return
        }
        if (tool === 'pan') { isPanning.current = false; setIsDragging(false); return }
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
        if (tool === 'freehand') {
          setSelectedIds([])
        } else {
          setTool('select')
          setSelectedIds([newId])
        }
      }

      // Element drag — tək və ya group
      const handleDragStart = useCallback((id: string) => {
        if (selectedIds.length > 1 && selectedIds.includes(id)) {
          isDraggingGroup.current = true
          const positions: Record<string, { x: number; y: number }> = {}
          elements.forEach((el) => {
            if (selectedIds.includes(el.id)) {
              positions[el.id] = { x: el.data.x ?? 0, y: el.data.y ?? 0 }
            }
          })
          dragStartPositions.current = positions
        }
      }, [selectedIds, elements])


      // Element bounding box — sol yuxarı künc + ölçü
      const handleDragEnd = useCallback((id: string, e: Konva.KonvaEventObject<DragEvent>) => {
        pushHistory()

        // Sürüklənmə bitəndə elementin son mərkəzi hansı A4-ün üstündədirsə,
        // page_id-ni ona köçürür — beləliklə element vizual olaraq harda görünürsə,
        // export də (və digər səhifə-əsaslı filtrlər) elə ora aid sayır.
        const reassignPageIfMoved = (el: CanvasElement, mergedData: Record<string, unknown>) => {
          const bbox = getElBBox({ ...el, data: { ...el.data, ...mergedData } } as CanvasElement)
          const cx = bbox.x + bbox.w / 2
          const cy = bbox.y + bbox.h / 2
          const newPageId = getPageIdAtPoint(cx, cy)
          if (newPageId && newPageId !== el.page_id) {
            setElementPageId(el.id, newPageId)
          }
        }

        if (isDraggingGroup.current && selectedIds.length > 1 && selectedIds.includes(id)) {
          const newX = e.target.x()
          const newY = e.target.y()
          const startPos = dragStartPositions.current[id]
          if (startPos) {
            const dx = newX - startPos.x
            const dy = newY - startPos.y
            selectedIds.forEach((sid) => {
              const sp = dragStartPositions.current[sid]
              if (!sp) return
              const newData = { x: sp.x + dx, y: sp.y + dy }
              updateElement(sid, newData)
              const elSid = elementsRef.current.find((e) => e.id === sid)
              if (elSid) reassignPageIfMoved(elSid, newData)
            })
          }
          isDraggingGroup.current = false
        } else {
          const el = elementsRef.current.find((el) => el.id === id)
          if (el && ['line', 'arrow', 'freehand'].includes(el.type)) {
            const nx = e.target.x()
            const ny = e.target.y()
            const pts = el.data.points || []
            const newData = { x: 0, y: 0, points: pts.map((v, i) => i % 2 === 0 ? v + nx : v + ny) }
            updateElement(id, newData)
            e.target.x(0); e.target.y(0)
            reassignPageIfMoved(el, newData)
          } else if (el) {
            const newData = { x: e.target.x(), y: e.target.y() }
            updateElement(id, newData)
            reassignPageIfMoved(el, newData)
          }
        }
      }, [selectedIds, pushHistory, updateElement, getPageIdAtPoint, setElementPageId])

      // Verilmiş enə görə mətnin daxildə tutduğu real hündürlük — qutu bundan aşağı kiçilməsin
      const minTextAreaHeight = (el: CanvasElement, boxWidth: number) => {
        const d = el.data as ExtendedData & typeof el.data
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
          const nx = node.x(); const ny = node.y()
          const pts = el.data.points || []
          updateElement(id, {
            x: 0, y: 0,
            points: pts.map((v, i) => i % 2 === 0 ? v * sx + nx : v * sy + ny),
            scaleX: 1, scaleY: 1,
          })
          node.scaleX(1); node.scaleY(1)
          node.x(0); node.y(0)
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

      // Element-in page-i aktivdirmi? (heç bir page seçilməyibsə hamısı "aktiv" sayılır)
      const isPageActive = useCallback((pid?: string) => (
          activePageId === null || activePageId === undefined ? true : pid === activePageId
      ), [activePageId])

      const commonProps = (el: CanvasElement): ShapeProps => {
        const ghost = !isPageActive(el.page_id)
        return {
          id: el.id,
          draggable: tool === 'select' && !ghost,
          listening: !ghost,
          opacity: (el.data.opacity ?? 1) * (ghost ? 0.35 : 1),
          onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true
            handleElementClick(el, e)
          },
          onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
            e.cancelBubble = true
          },
          onDragStart: () => handleDragStart(el.id),
          onDragEnd:   (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el.id, e),
          onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(el.id, e),
        }
      }

      // Path shape-lər üçün ortaq render helper
      const renderPathShape = (
          el: CanvasElement,
          cp: ShapeProps,
          pathData: string,
          w: number, h: number
      ) => {
        const d = el.data
        return (
            <Path key={el.id} {...cp}
                  x={d.x ?? 0} y={d.y ?? 0}
                  data={applySloppinessPath(pathData, d.sloppiness ?? 0, el.id)}
                  fill={d.fill === 'transparent' ? undefined : d.fill}
                  stroke={d.stroke === 'transparent' ? undefined : d.stroke}
                  strokeWidth={d.strokeWidth} rotation={d.rotation ?? 0} dash={d.dash}
                  hitFunc={makeRectHitFunc(w, h)} />
        )
      }

      const renderElement = (el: CanvasElement) => {
        const d = el.data as typeof el.data & ExtendedData; const cp = commonProps(el)
        switch (el.type) {
          case 'rect': {
            const slop = d.sloppiness ?? 0
            const jitter = slop === 1 ? 1.5 : slop === 2 ? 3 : 0
            const rawCr = d.cornerRadius  // number | number[] | undefined — Konva Rect qəbul edir
            const cr = normCr(d.cornerRadius)
            return <Rect key={el.id} {...cp}
                         x={(d.x??0) + (jitter ? (Math.sin(el.id.charCodeAt(0))*jitter) : 0)}
                         y={(d.y??0) + (jitter ? (Math.cos(el.id.charCodeAt(1))*jitter) : 0)}
                         width={Math.abs(d.width||0) + (jitter ? Math.abs(Math.sin(el.id.charCodeAt(2))*jitter) : 0)}
                         height={Math.abs(d.height||0) + (jitter ? Math.abs(Math.cos(el.id.charCodeAt(3))*jitter) : 0)}
                         {...sharedRectProps(d)}
                         cornerRadius={slop > 0
                             ? (Array.isArray(rawCr) ? (rawCr as number[]).map(v => v + slop*2) : cr + slop*2)
                             : (rawCr ?? 0)} />
          }
          case 'circle': {
            const slop = d.sloppiness ?? 0
            const jitter = slop === 1 ? 1.5 : slop === 2 ? 4 : 0
            const j = (i: number) => jitter ? Math.sin(el.id.charCodeAt(i) + i) * jitter : 0
            return <Rect key={el.id} {...cp}
                         x={(d.x??0)+j(0)} y={(d.y??0)+j(1)}
                         width={Math.abs(d.width||0)+Math.abs(j(2))} height={Math.abs(d.height||0)+Math.abs(j(3))}
                         {...sharedRectProps(d)}
                         cornerRadius={normCr(d.cornerRadius) || 99999} />
          }
          case 'line': {
            const pts = d.points || []
            const slop = d.sloppiness ?? 0
            const hasBend = checkBend(pts)

            const buildLinePts = (): number[] => {
              const x0 = pts[0], y0 = pts[1]
              const x1 = pts[pts.length-2], y1 = pts[pts.length-1]
              if (slop === 0) return hasBend ? pts : [x0,y0,x1,y1]
              return buildSloppyPts(x0, y0, x1, y1, slop, el.id)
            }

            const renderPts = buildLinePts()
            return (
                <Line key={el.id} {...cp} points={renderPts} stroke={d.stroke} strokeWidth={d.strokeWidth}
                      lineCap="round" lineJoin="round"
                      tension={slop >= 1 ? 0.5 : hasBend ? 0.5 : 0}
                      dash={d.dash}
                />
            )
          }
          case 'arrow': {
            const pts = d.points || []
            const slop = d.sloppiness ?? 0
            const hasBend = checkBend(pts)
            const buildArrowPts = (): number[] => {
              const x0=pts[0], y0=pts[1]
              const x1=pts[pts.length-2], y1=pts[pts.length-1]
              const mx = pts.length >= 6 ? pts[2] : (x0+x1)/2
              const my = pts.length >= 6 ? pts[3] : (y0+y1)/2
              if (slop === 0 && !hasBend) return [x0,y0,x1,y1]
              if (slop === 0) {
                // Bezier interpolasiya — əyri arrow
                const result: number[] = []
                for (let i=0;i<=14;i++){
                  const t=i/14
                  result.push(
                      (1-t)*(1-t)*x0+2*(1-t)*t*mx+t*t*x1,
                      (1-t)*(1-t)*y0+2*(1-t)*t*my+t*t*y1
                  )
                }
                return result
              }
              return buildSloppyPts(x0, y0, x1, y1, slop, el.id)
            }
            const sw = d.strokeWidth ?? 2
            return (
                <Arrow key={el.id} {...cp}
                       points={buildArrowPts()}
                       stroke={d.stroke} strokeWidth={sw}
                       fill={d.stroke}
                       pointerLength={Math.max(12, sw * 5)}
                       pointerWidth={Math.max(10, sw * 4)}
                       tension={slop >= 1 ? 0.5 : 0} lineCap="round" lineJoin="round"
                       dash={d.dash}
                />
            )
          }
          case 'freehand': {
            const slop = d.sloppiness ?? 0
            return <Line key={el.id} {...cp} points={d.points} stroke={d.stroke} strokeWidth={d.strokeWidth}
                         tension={slop === 0 ? 0.5 : slop === 1 ? 0.65 : 0.8}
                         lineCap="round" lineJoin="round" dash={d.dash} />
          }
          case 'text':
            return (
                <RichTextShape
                    key={el.id}
                    el={el}
                    draggable={tool === 'select' && editingId !== el.id}
                    ghost={!isPageActive(el.page_id)}
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
            const cr = normCr(d.cornerRadius)
            const rx = w / 2; const ry = h / 2
            const pts: number[][] = []
            for (let i = 0; i < sides; i++) {
              const angle = (Math.PI * 2 * i / sides) - Math.PI / 2
              pts.push([rx + rx * Math.cos(angle), ry + ry * Math.sin(angle)])
            }
            return renderPathShape(el, cp, roundedPolygonPath(pts, cr), w, h)
          }

          case 'star': {
            const w = Math.abs(d.width ?? 0); const h = Math.abs(d.height ?? 0)
            const cr = normCr(d.cornerRadius)
            const outerRx = w / 2; const outerRy = h / 2
            const innerRx = outerRx * 0.45; const innerRy = outerRy * 0.45
            const pts: number[][] = []
            for (let i = 0; i < 10; i++) {
              const angle = (Math.PI * i / 5) - Math.PI / 2
              const rx = i % 2 === 0 ? outerRx : innerRx
              const ry = i % 2 === 0 ? outerRy : innerRy
              pts.push([outerRx + rx * Math.cos(angle), outerRy + ry * Math.sin(angle)])
            }
            return renderPathShape(el, cp, roundedPolygonPath(pts, cr), w, h)
          }

          case 'diamond': {
            const w = Math.abs(d.width ?? 0); const h = Math.abs(d.height ?? 0)
            const cr = normCr(d.cornerRadius)
            const diamondPts: number[][] = [[w/2,0],[w,h/2],[w/2,h],[0,h/2]]
            return renderPathShape(el, cp, roundedPolygonPath(diamondPts, cr), w, h)
          }

          case 'parallelogram': {
            const pw = Math.abs(d.width ?? 0); const ph = Math.abs(d.height ?? 0)
            const cr = normCr(d.cornerRadius)
            const skew = pw * 0.25
            const paraPts: number[][] = [[skew,0],[pw,0],[pw-skew,ph],[0,ph]]
            return renderPathShape(el, cp, roundedPolygonPath(paraPts, cr), pw, ph)
          }

          case 'cross': {
            const cw = Math.abs(d.width??0); const ch = Math.abs(d.height??0)
            const t = cw/3; const t2 = ch/3
            const cr = normCr(d.cornerRadius)
            const crossPts = [
              [t, 0], [cw-t, 0], [cw-t, t2], [cw, t2],
              [cw, ch-t2], [cw-t, ch-t2], [cw-t, ch], [t, ch],
              [t, ch-t2], [0, ch-t2], [0, t2], [t, t2],
            ]
            return renderPathShape(el, cp, roundedPolygonPath(crossPts, cr), cw, ch)
          }

          case 'cylinder': {
            const cyW = Math.abs(d.width??0); const cyH = Math.abs(d.height??0)
            const ry = Math.max(cyH * 0.15, 8)
            const fill = d.fill==='transparent'?undefined:d.fill
            const stroke = d.stroke==='transparent'?undefined:d.stroke
            const cyProps = { fill, stroke, strokeWidth: d.strokeWidth, dash: d.dash }
            return (
                <Group key={el.id} {...cp}
                       x={d.x??0} y={d.y??0}
                       width={cyW} height={cyH}
                       rotation={d.rotation??0}
                       opacity={d.opacity??1}
                >
                  {/* Gövdə */}
                  <Rect x={0} y={ry} width={cyW} height={cyH - ry*2} {...cyProps}/>
                  {/* Alt ellips */}
                  <Ellipse x={cyW/2} y={cyH - ry} radiusX={cyW/2} radiusY={ry} {...cyProps}/>
                  {/* Üst ellips */}
                  <Ellipse x={cyW/2} y={ry} radiusX={cyW/2} radiusY={ry} {...cyProps}/>
                </Group>
            )
          }

          case 'image':
            return <ImageElement key={el.id} el={el} commonProps={cp} />
          default: return null
        }
      }

      const editingEl = editingId ? elements.find((e) => e.id === editingId) : null

      // ── Arrow/Line handle-ları — ayrı Layer-də render edilir ki Transformer ilə konflikt olmasın ──
      const renderLineHandles = () => {
        if (tool !== 'select' || selectedIds.length !== 1) return null
        const el = elements.find(e => e.id === selectedIds[0])
        if (!el || !['line','arrow'].includes(el.type)) return null
        const pts = el.data.points || []
        if (pts.length < 6) return null

        // Scale-ə görə handle ölçüsünü tənzimlə — zoom edəndə handle-lar çox böyüməsin
        const sc = stageScale
        const hs = Math.max(8, Math.min(14, 10 / sc))  // ekran pikseli olaraq sabit görünür
        const hs2 = hs / 2

        const updatePts = (newPts: number[]) => updateElement(el.id, { points: newPts })

        return (
            <>
              {/* Uç nöqtələr — ağ kvadrat, mavi kənar */}
              {[
                { dataIdx: 0 },
                { dataIdx: 4 },
              ].map(({ dataIdx }) => {
                const px = pts[dataIdx]; const py = pts[dataIdx+1]
                return (
                    <Rect key={`h-end-${dataIdx}`}
                          x={px - hs2} y={py - hs2}
                          width={hs} height={hs}
                          fill="#ffffff" stroke="#4f46e5" strokeWidth={Math.max(1.5, 2/sc)}
                          cornerRadius={2}
                          draggable
                          onMouseDown={e => { e.cancelBubble = true }}
                          onDragMove={e => {
                            e.cancelBubble = true
                            const node = e.target
                            const nx = node.x() + hs2; const ny = node.y() + hs2
                            const cur = [...(elements.find(v=>v.id===el.id)?.data.points || pts)]
                            cur[dataIdx] = nx; cur[dataIdx+1] = ny
                            // Orta nöqtə hələ sürüklənməyibsə avtomatik mərkəzdə saxla
                            const defMx=(cur[0]+cur[4])/2; const defMy=(cur[1]+cur[5])/2
                            if (Math.hypot(cur[2]-defMx, cur[3]-defMy) < 20) {
                              cur[2]=defMx; cur[3]=defMy
                            }
                            updatePts(cur)
                            node.x(nx-hs2); node.y(ny-hs2)
                          }}
                          onDragEnd={() => pushHistory()}
                    />
                )
              })}

              {/* Orta nöqtə — indigo dairə, sürükləyərək əy */}
              {(() => {
                const mx=pts[2], my=pts[3]
                const ms = hs + 2; const ms2 = ms/2
                return (
                    <Rect key="h-mid"
                          x={mx-ms2} y={my-ms2}
                          width={ms} height={ms}
                          fill="#6366f1" stroke="#ffffff" strokeWidth={Math.max(1.5, 2/sc)}
                          cornerRadius={ms2}
                          draggable
                          onMouseDown={e => { e.cancelBubble = true }}
                          onDragMove={e => {
                            e.cancelBubble = true
                            const node = e.target
                            const nx=node.x()+ms2; const ny=node.y()+ms2
                            const cur=[...(elements.find(v=>v.id===el.id)?.data.points||pts)]
                            cur[2]=nx; cur[3]=ny
                            updatePts(cur)
                            node.x(nx-ms2); node.y(ny-ms2)
                          }}
                          onDblClick={() => {
                            const cur=[...(elements.find(v=>v.id===el.id)?.data.points||pts)]
                            cur[2]=(cur[0]+cur[4])/2; cur[3]=(cur[1]+cur[5])/2
                            updatePts(cur); pushHistory()
                          }}
                          onDragEnd={() => pushHistory()}
                    />
                )
              })()}
            </>
        )
      }

      const cursorStyle = isSpacePan
          ? (isDragging ? 'grabbing' : 'grab')
          : tool === 'pan'    ? (isDragging ? 'grabbing' : 'grab')
              : tool === 'eraser' ? 'none'
                  : tool === 'select' ? 'default'
                      : 'crosshair'


      // 3 sütunlu grid: hər A4 arasında GAP boşluq var
      // Səhifə canvas koordinatında: col * (A4_W + GAP), row * (A4_H + GAP)
      const COLS    = GRID_COLS
      const PAGE_GAP = GRID_PAGE_GAP  // canvas koordinatında px

      // Hər page-in canvas mövqeyini hesabla
      const pagePositions = pages.map((_, idx) => {
        const col = idx % COLS
        const row = Math.floor(idx / COLS)
        return {
          x: col * (A4_W_PT + PAGE_GAP),
          y: row * (A4_H_PT + PAGE_GAP),
        }
      })

      // Aktiv page-in ölçüsü (portrait/landscape)
      const getPageSize = (page: typeof pages[0]) => ({
        w: page.orientation === 'landscape' ? A4_H_PT : A4_W_PT,
        h: page.orientation === 'landscape' ? A4_W_PT : A4_H_PT,
      })

      // Boş yerdə double-click — altındakı page-i seç
      const handleStageDblClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
        if (e.target.getType() !== 'Stage') return
        const pos = getPointerOnStage()
        // Hansı page-in içindədir?
        for (let i = pages.length - 1; i >= 0; i--) {
          const page = pages[i]
          const ppos = pagePositions[i]
          const size = getPageSize(page)
          if (
              pos.x >= ppos.x && pos.x <= ppos.x + size.w &&
              pos.y >= ppos.y && pos.y <= ppos.y + size.h
          ) {
            if (page.id !== activePageId) switchPage(canvasId, page.id)
            break
          }
        }
      }, [pages, pagePositions, activePageId, switchPage, canvasId, getPointerOnStage])

      // HTML overlay: page-i ekran koordinatına çevir
      const toScreen = (cx: number, cy: number) => ({
        x: stagePos.x + cx * stageScale,
        y: stagePos.y + cy * stageScale,
      })

      // "+" düyməsinin yeri: sonuncu page-in sağı
      const lastIdx = pages.length - 1
      const lastPos = pagePositions[lastIdx] ?? { x: 0, y: 0 }
      const lastPage = pages[lastIdx]
      const lastSize = lastPage ? getPageSize(lastPage) : { w: A4_W_PT, h: A4_H_PT }
      const addBtnCanvas = {
        x: lastPos.x + lastSize.w,
        y: lastPos.y + lastSize.h / 2,
      }
      const addBtnScreen = toScreen(addBtnCanvas.x, addBtnCanvas.y)

      const handleAddPage = async () => {
        try { await createPage(canvasId) }
        catch { alert('Səhifə yaradılmadı') }
      }

      const handleDeletePage = async (pageId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (pages.length <= 1) { alert('Son səhifəni silmək olmaz'); return }
        try { await deletePage(canvasId, pageId) }
        catch { alert('Səhifə silinmədi') }
      }

      return (
          <div
              className="relative w-full h-full overflow-hidden"
              style={{
                background: '#edf0f5',
                backgroundImage: `linear-gradient(rgba(148,163,184,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.15) 1px, transparent 1px)`,
                backgroundSize: `${40 * stageScale}px ${40 * stageScale}px`,
                backgroundPosition: `${stagePos.x}px ${stagePos.y}px`,
              }}
          >
            <Stage
                ref={stageRef}
                width={width} height={height}
                scaleX={stageScale} scaleY={stageScale}
                x={stagePos.x} y={stagePos.y}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                onDblClick={handleStageDblClick}
                draggable={false}
                style={{ cursor: cursorStyle }}
            >
              <Layer listening={false}>
                {/* Bütün page-ləri Konva içində render et (kölgə + kağız) */}
                {pages.map((page, idx) => {
                  const pos  = pagePositions[idx]
                  const size = getPageSize(page)
                  return (
                      <React.Fragment key={page.id}>
                        {/* Kölgə */}
                        <Rect x={pos.x + 4} y={pos.y + 6} width={size.w} height={size.h} fill="rgba(0,0,0,0.12)" listening={false} />
                        {/* Ağ kağız */}
                        <Rect
                            x={pos.x} y={pos.y} width={size.w} height={size.h}
                            fill="#ffffff"
                            stroke={activePageId === page.id ? '#6366f1' : '#e2e8f0'}
                            strokeWidth={(activePageId === page.id ? 2 : 1) / stageScale}
                            listening={false}
                        />
                      </React.Fragment>
                  )
                })}
              </Layer>

              <Layer>
                {/* BÜTÜN page-lərin elementləri TƏK bir map-də render olunur (aktiv page-in
                    elementləri əvvəllər ayrı Group-a keçirdi, bu da page seçiləndə həmin
                    elementlərin (xüsusən Image-in) remount olmasına və bununla da şəklin
                    bir anlıq/yenidən yüklənməsi lazım olmasına səbəb olurdu — nadir hallarda
                    şəkil heç yüklənmirdi. İndi eyni el.id həmişə eyni siyahıda qalır,
                    React node-u sadəcə yerini dəyişir, remount etmir).
                    Qeyri-aktiv page-lərin elementləri əvvəldə (altda, solğun),
                    aktiv page-in elementləri sonda (üstdə) sıralanır. */}
                {[...elements].sort((a, b) => {
                  const aActive = isPageActive(a.page_id) ? 1 : 0
                  const bActive = isPageActive(b.page_id) ? 1 : 0
                  if (aActive !== bActive) return aActive - bActive
                  return (a.z_index ?? 0) - (b.z_index ?? 0)
                }).map((el) => renderElement(el))}
                {selBox && selBox.w > 2 && (
                    <Rect
                        x={selBox.x} y={selBox.y} width={selBox.w} height={selBox.h}
                        fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth={1 / stageScale}
                        dash={[4 / stageScale, 2 / stageScale]}
                        listening={false}
                    />
                )}
                <SelectionTransformer onMount={onTransformerMount} selectedCount={selectedIds.length} />
              </Layer>

              <Layer listening={true}>
                {renderLineHandles()}
              </Layer>
            </Stage>

            {/* ── HTML Overlay: page seçim xətti, X düyməsi, + düyməsi ── */}
            {pages.map((page, idx) => {
              const pos    = pagePositions[idx]
              const size   = getPageSize(page)
              const scr    = toScreen(pos.x, pos.y)
              const sw     = size.w * stageScale
              const sh     = size.h * stageScale
              const isActive = activePageId === page.id

              return (
                  <div
                      key={`overlay-${page.id}`}
                      style={{
                        position: 'absolute',
                        left: scr.x,
                        top:  scr.y,
                        width:  sw,
                        height: sh,
                        pointerEvents: 'none',
                        zIndex: 5,
                      }}
                  >
                    {/* Seçim xətti */}
                    {isActive && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          border: `2px solid #6366f1`,
                          borderRadius: 2,
                          pointerEvents: 'none',
                          boxShadow: '0 0 0 1px rgba(99,102,241,0.2)',
                        }} />
                    )}

                    {/* Səhifə nömrəsi — sol alt künc */}
                    <div style={{
                      position: 'absolute', bottom: 6, left: 8,
                      fontSize: Math.max(9, 11 * stageScale),
                      color: '#94a3b8',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}>
                      {idx + 1}
                    </div>

                    {/* X sil düyməsi — active olanda görünür, pointerEvents: all */}
                    {pages.length > 1 && (
                        <button
                            onClick={(e) => handleDeletePage(page.id, e)}
                            style={{
                              position: 'absolute',
                              top: -10,
                              right: -10,
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: '#ef4444',
                              border: '2px solid white',
                              color: 'white',
                              fontSize: 13,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              pointerEvents: 'all',
                              zIndex: 20,
                              opacity: isActive ? 1 : 0,
                              transition: 'opacity 0.15s',
                              padding: 0,
                              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                            }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = isActive ? '1' : '0'}
                        >
                          ×
                        </button>
                    )}
                  </div>
              )
            })}

            {/* + Yeni səhifə düyməsi — sonuncu page-in sağında */}
            <button
                onClick={handleAddPage}
                style={{
                  position: 'absolute',
                  left: addBtnScreen.x + 20,
                  top:  addBtnScreen.y - 14,
                  width: 28, height: 28,
                  borderRadius: 8,
                  background: 'rgba(30,41,59,0.85)',
                  backdropFilter: 'blur(8px)',
                  color: '#94a3b8',
                  fontSize: 18,
                  fontWeight: 300,
                  cursor: 'pointer',
                  border: '1px solid rgba(99,102,241,0.3)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  zIndex: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  lineHeight: 1,
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = '#6366f1'
                  el.style.color = 'white'
                  el.style.borderColor = '#6366f1'
                  el.style.boxShadow = '0 4px 12px rgba(99,102,241,0.4)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'rgba(30,41,59,0.85)'
                  el.style.color = '#94a3b8'
                  el.style.borderColor = 'rgba(99,102,241,0.3)'
                  el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
                }}
                title="Yeni səhifə əlavə et"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>

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

            {tool === 'eraser' && eraserPos && (
                <div
                    style={{
                      position: 'absolute',
                      pointerEvents: 'none',
                      left: stagePos.x + eraserPos.x * stageScale - eraserSize * stageScale,
                      top:  stagePos.y + eraserPos.y * stageScale - eraserSize * stageScale,
                      width:  eraserSize * 2 * stageScale,
                      height: eraserSize * 2 * stageScale,
                      borderRadius: '50%',
                      border: '2px solid #6366f1',
                      background: 'rgba(99,102,241,0.08)',
                    }}
                />
            )}
          </div>
      )
    })

export default CanvasBoard

// Qlobal şəkil cache — eyni URL remount olsa belə yenidən yüklənməsin
const imageCache = new Map<string, HTMLImageElement>()

function ImageElement({ el, commonProps }: { el: CanvasElement; commonProps: object }) {
  const src = (el.data.src as string | undefined) ?? ''
  const [image, setImage] = useState<HTMLImageElement | null>(() => (src ? imageCache.get(src) ?? null : null))
  const d = el.data
  useEffect(() => {
    if (!src) return
    // Cache-də varsa dərhal istifadə et
    const cached = imageCache.get(src)
    if (cached) {
      setImage(cached)
      return
    }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageCache.set(src, img)
      setImage(img)
    }
    img.onerror = () => console.error('Şəkil yüklənmədi:', src)
    img.src = src
  }, [src])
  if (!image) return null
  return <KonvaImage {...commonProps} x={d.x} y={d.y} width={d.width} height={d.height} image={image} rotation={d.rotation} />
}
// Transformer-i ayrı komponentə çıxarırıq ki render zamanı ref oxuma xətası olmasın
interface SelectionTransformerProps {
  onMount: (tr: Konva.Transformer | null) => void
  selectedCount: number
}
function SelectionTransformer({ onMount, selectedCount }: SelectionTransformerProps) {
  return (
      <Transformer
          ref={onMount}
          rotateEnabled={selectedCount === 1}
          enabledAnchors={selectedCount === 1
              ? ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center']
              : []
          }
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
          ignoreStroke={true}
          shouldOverdrawWholeArea={false}
      />
  )
}