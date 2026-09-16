import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { canvasApi } from '../api/canvas'
import { booksApi } from '../api/books'
import { useCanvasStore } from '../store/canvasStore'
import { useBookStore } from '../store/bookStore'
import { useAutoSave } from '../hooks/useAutoSave'
import { useKeyboard } from '../hooks/useKeyboard'
import Toolbar from '../components/canvas/Toolbar'
import CanvasBoard from '../components/canvas/CanvasBoard'
import PropertiesPanel from '../components/canvas/PropertiesPanel'
import PDFViewer from '../components/pdf/PDFViewer'
import type { Canvas } from '../types'
import jsPDF from 'jspdf'

export default function Editor() {
  const { id: canvasId } = useParams<{ id: string }>()
  const [searchParams]   = useSearchParams()
  const bookId = searchParams.get('book')

  const { setElements, isDirty } = useCanvasStore()
  const { setCurrentBook } = useBookStore()

  const [canvas,      setCanvas]      = useState<Canvas | null>(null)
  const [canvasTitle, setCanvasTitle] = useState('')
  const [pdfOpen,     setPdfOpen]     = useState(false)
  const [pdfUrl,      setPdfUrl]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const containerRef   = useRef<HTMLDivElement>(null)
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useAutoSave(canvasId || '')
  useKeyboard()

  // Container ölçüsü
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerSize({
          width:  containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    const obs = new ResizeObserver(update)
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [pdfOpen])

  // Canvas yüklə
  useEffect(() => {
    if (!canvasId) return
    const load = async () => {
      try {
        const [canvasRes, elementsRes] = await Promise.all([
          canvasApi.getById(canvasId),
          canvasApi.getElements(canvasId),
        ])
        const c = canvasRes.data.data
        setCanvas(c)
        setCanvasTitle(c.title)
        setElements(elementsRes.data.data || [])
      } catch (err) {
        console.error('Canvas yüklənmədi:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [canvasId])

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
  }, [bookId, canvas])

  const handleTitleChange = (title: string) => {
    setCanvasTitle(title)
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    titleSaveTimer.current = setTimeout(() => {
      if (canvasId) canvasApi.updateTitle(canvasId, title).catch(() => {})
    }, 1000)
  }

  // PDF export — bütün canvas sahəsini götür
  const handleExport = async () => {
    if (!canvasId) return
    const stageEl = document.querySelector('canvas')
    if (!stageEl) return
    try {
      const dataUrl = stageEl.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({
        orientation: stageEl.width > stageEl.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [stageEl.width, stageEl.height],
      })
      pdf.addImage(dataUrl, 'PNG', 0, 0, stageEl.width, stageEl.height)
      const blob = pdf.output('blob')
      const res  = await canvasApi.exportPdf(canvasId, blob)
      const url  = res.data.data.url
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${canvasTitle || 'canvas'}.pdf`
      a.click()
    } catch {
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

  const canvasWidth = pdfOpen
    ? Math.floor(containerSize.width * 0.58)
    : containerSize.width

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-200 shrink-0">
        <a
          href="/dashboard"
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
        >
          <ArrowLeft size={17} />
        </a>
        <Toolbar
          onExport={handleExport}
          onTogglePdf={() => setPdfOpen((v) => !v)}
          pdfOpen={pdfOpen}
          isDirty={isDirty}
          canvasTitle={canvasTitle}
          onTitleChange={handleTitleChange}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden"
          style={{ width: pdfOpen ? '58%' : '100%' }}
        >
          {containerSize.width > 0 && (
            <CanvasBoard width={canvasWidth} height={containerSize.height} />
          )}
        </div>

        {/* Properties panel */}
        <PropertiesPanel />

        {/* PDF panel */}
        {pdfOpen && pdfUrl && (
          <div className="border-l border-gray-200 overflow-hidden" style={{ width: '42%' }}>
            <PDFViewer
              bookId={bookId || canvas?.book_id || ''}
              fileUrl={pdfUrl}
            />
          </div>
        )}

        {pdfOpen && !pdfUrl && (
          <div className="border-l border-gray-200 flex items-center justify-center bg-gray-50" style={{ width: '42%' }}>
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
