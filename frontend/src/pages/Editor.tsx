import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { canvasApi } from '../api/canvas'
import { booksApi } from '../api/books'
import { useCanvasStore } from '../store/canvasStore'
import { useBookStore } from '../store/bookStore'
import { usePageStore } from '../store/pageStore'
import { useAutoSave } from '../hooks/useAutoSave'
import { useKeyboard } from '../hooks/useKeyboard'
import Toolbar from '../components/canvas/Toolbar'
import CanvasBoard, { type CanvasBoardHandle } from '../components/canvas/CanvasBoard'
import LeftPanel from '../components/canvas/LeftPanel'
import PageSidebar from '../components/canvas/PageSidebar'
import PDFViewer from '../components/pdf/PDFViewer'
import type { Canvas } from '../types'
import jsPDF from 'jspdf'

export default function Editor() {
  const { id: canvasId } = useParams<{ id: string }>()
  const [searchParams]   = useSearchParams()
  const bookId = searchParams.get('book')

  const { setElements, isDirty } = useCanvasStore()
  const { setCurrentBook }       = useBookStore()
  const { loadPages }            = usePageStore()

  const [canvas,      setCanvas]      = useState<Canvas | null>(null)
  const [canvasTitle, setCanvasTitle] = useState('')
  const [pdfOpen,     setPdfOpen]     = useState(false)
  const [pdfUrl,      setPdfUrl]      = useState('')
  const [pdfWidth,    setPdfWidth]    = useState(420)
  const [loading,     setLoading]     = useState(true)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [isDraggingPdf, setIsDraggingPdf] = useState(false)

  const containerRef    = useRef<HTMLDivElement>(null)
  const canvasBoardRef  = useRef<CanvasBoardHandle>(null)
  const titleSaveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useAutoSave(canvasId || '')
  useKeyboard()

  // Container ölçüsü — loading, pdfOpen dəyişəndə yenidən qoş
  useEffect(() => {
    if (loading) return

    const update = () => {
      if (containerRef.current) {
        setContainerSize({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }

    const raf = requestAnimationFrame(() => {
      update()
      const obs = new ResizeObserver(update)
      if (containerRef.current) obs.observe(containerRef.current)
      ;(containerRef as any)._obs = obs
    })

    return () => {
      cancelAnimationFrame(raf)
      ;(containerRef as any)._obs?.disconnect()
    }
  }, [loading, pdfOpen])

  // Canvas yüklə + page-ləri yüklə
  useEffect(() => {
    if (!canvasId) return
    const load = async () => {
      try {
        const canvasRes = await canvasApi.getById(canvasId)
        const c = canvasRes.data.data
        setCanvas(c)
        setCanvasTitle(c.title)

        // Page-ləri yüklə (birinci page-in elementlərini də yükləyir)
        await loadPages(canvasId)
      } catch (err) {
        console.error('Canvas yüklənmədi:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [canvasId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kitab yüklə
  useEffect(() => {
    const loadBook = async (id: string) => {
      try {
        const res = await booksApi.getById(id)
        setCurrentBook(res.data.data)
        setPdfUrl(booksApi.getFileUrl(id))
        setPdfOpen(true)
      } catch {}
    }
    if (bookId) loadBook(bookId)
    else if (canvas?.book_id) loadBook(canvas.book_id)
  }, [bookId, canvas]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleChange = (title: string) => {
    setCanvasTitle(title)
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    titleSaveTimer.current = setTimeout(() => {
      if (canvasId) canvasApi.updateTitle(canvasId, title).catch(() => {})
    }, 1000)
  }

  // PDF export
  const handleExport = async () => {
    if (!canvasId || !canvasBoardRef.current) return
    try {
      const dataUrl = canvasBoardRef.current.exportImage()
      if (!dataUrl) {
        alert('Canvas boşdur')
        return
      }

      const img = new window.Image()
      img.src = dataUrl
      await new Promise<void>((res) => { img.onload = () => res() })

      const w = img.width  / 2
      const h = img.height / 2

      const pdf = new jsPDF({
        orientation: w > h ? 'landscape' : 'portrait',
        unit: 'px',
        format: [w, h],
        hotfixes: ['px_scaling'],
      })

      pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)

      const blob = pdf.output('blob')

      try {
        const res  = await canvasApi.exportPdf(canvasId, blob)
        const url  = res.data.data.url
        const a    = document.createElement('a')
        a.href     = url
        a.download = `${canvasTitle || 'canvas'}.pdf`
        a.target   = '_blank'
        a.click()
      } catch {
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href     = url
        a.download = `${canvasTitle || 'canvas'}.pdf`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (err) {
      console.error('Export xətası:', err)
      alert('Export zamanı xəta baş verdi')
    }
  }

  if (loading) {
    return (
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="text-gray-400 text-sm">Yüklənir...</div>
        </div>
    )
  }

  return (
      <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
        {/* Header — minimal: geri düyməsi + canvas adı + PDF/Export */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-gray-200 shrink-0" style={{ minHeight: 44 }}>
          <a
              href="/dashboard"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
          >
            <ArrowLeft size={17} />
          </a>
          {/* Canvas adı — ortada */}
          <input
              value={canvasTitle}
              onChange={e => handleTitleChange(e.target.value)}
              className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none text-center hover:bg-gray-50 rounded px-2 py-0.5 transition-colors"
              style={{ minWidth: 120, maxWidth: 320 }}
              placeholder="Canvas adı"
          />
          {/* Sağ: dirty indicator + PDF + Export */}
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-sm select-none ${isDirty ? 'text-amber-400' : 'text-emerald-400'}`}>
              {isDirty ? '●' : '✓'}
            </span>
            <button
                onClick={() => setPdfOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 ${
                    pdfOpen
                        ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <span style={{ fontSize: 14 }}>📖</span> PDF
            </button>
            <button
                onClick={handleExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all shadow-sm shrink-0"
            >
              ↓ İxrac
            </button>
          </div>
        </div>

        {/* Main area */}
        <div className="flex flex-1 overflow-hidden">

          {/* Page sidebar — sol tərəf */}
          {canvasId && <PageSidebar canvasId={canvasId} />}

          {/* Left panel — flex içində, canvas-ı sağa itələyir */}
          <LeftPanel />

          {/* Canvas area */}
          <div
              ref={containerRef}
              className="flex-1 overflow-hidden relative"
          >
            {containerSize.width > 0 && (
                <CanvasBoard
                    ref={canvasBoardRef}
                    width={containerSize.width}
                    height={containerSize.height}
                    canvasId={canvasId || ''}
                />
            )}
            {/* Toolbar — canvas üzərində float, yuxarı-ortada */}
            <div style={{
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 30,
              pointerEvents: 'none',
            }}>
              <div style={{ pointerEvents: 'all' }}>
                <Toolbar
                    onExport={handleExport}
                    onTogglePdf={() => setPdfOpen((v) => !v)}
                    pdfOpen={pdfOpen}
                    isDirty={isDirty}
                    canvasTitle={canvasTitle}
                    onTitleChange={handleTitleChange}
                />
              </div>
            </div>
          </div>

          {/* PDF panel */}
          {pdfOpen && pdfUrl && (
              <>
                {/* Resize handle */}
                <div
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsDraggingPdf(true)
                      const startX = e.clientX
                      const startW = pdfWidth
                      const onMove = (ev: MouseEvent) => {
                        const delta = startX - ev.clientX
                        setPdfWidth(Math.max(280, Math.min(900, startW + delta)))
                      }
                      const onUp = () => {
                        setIsDraggingPdf(false)
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                      }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                    style={{
                      width: 5, flexShrink: 0, cursor: 'col-resize',
                      background: isDraggingPdf ? '#6366f1' : 'transparent',
                      borderLeft: '1px solid #e2e8f0',
                      position: 'relative', zIndex: 10,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#6366f1'}
                    onMouseLeave={e => {
                      if (!isDraggingPdf)
                        (e.currentTarget as HTMLElement).style.background = 'transparent'
                    }}
                />
                <div className="relative overflow-hidden shrink-0" style={{ width: pdfWidth }}>
                  {/* Drag zamanı iframe mouse event-lərini bloklayan overlay */}
                  {isDraggingPdf && (
                      <div style={{
                        position: 'absolute', inset: 0, zIndex: 50, cursor: 'col-resize',
                      }} />
                  )}
                  <PDFViewer
                      bookId={bookId || canvas?.book_id || ''}
                      fileUrl={pdfUrl}
                  />
                </div>
              </>
          )}

          {pdfOpen && !pdfUrl && (
              <div className="border-l border-gray-200 flex items-center justify-center bg-gray-50 shrink-0" style={{ width: 420 }}>
                <div className="text-center text-gray-400 p-6">
                  <p className="text-sm mb-3">Kitab seçilməyib</p>
                  <a href="/dashboard" className="text-indigo-500 hover:text-indigo-600 text-sm">
                    Dashboard-dan kitab seç
                  </a>
                </div>
              </div>
          )}
        </div>
      </div>
  )
}