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
import PDFViewer from '../components/pdf/PDFViewer'
import type { Canvas } from '../types'
import jsPDF from 'jspdf'

export default function Editor() {
  const { id: canvasId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const bookId = searchParams.get('book')

  const { setElements, isDirty } = useCanvasStore()
  const { setCurrentBook } = useBookStore()

  const [canvas, setCanvas] = useState<Canvas | null>(null)
  const [canvasTitle, setCanvasTitle] = useState('')
  const [pdfOpen, setPdfOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useAutoSave(canvasId || '')
  useKeyboard()

  // Container ölçüsü
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
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
        const book = res.data.data
        setCurrentBook(book)
        setPdfUrl(booksApi.getFileUrl(id))
        setPdfOpen(true)
      } catch (err) {
        console.error('Kitab yüklənmədi:', err)
      }
    }

    if (bookId) {
      loadBook(bookId)
    } else if (canvas?.book_id) {
      loadBook(canvas.book_id)
    }
  }, [bookId, canvas])

  // Başlıq dəyişdikdə saxla
  const handleTitleChange = (title: string) => {
    setCanvasTitle(title)
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    titleSaveTimer.current = setTimeout(() => {
      if (canvasId) canvasApi.updateTitle(canvasId, title).catch(() => {})
    }, 1000)
  }

  // PDF export
  const handleExport = async () => {
    if (!canvasId) return
    const stage = document.querySelector('canvas')
    if (!stage) return

    try {
      const dataUrl = stage.toDataURL('image/png', 1.0)
      const pdf = new jsPDF({
        orientation: stage.width > stage.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [stage.width, stage.height],
      })
      pdf.addImage(dataUrl, 'PNG', 0, 0, stage.width, stage.height)
      const blob = pdf.output('blob')
      const res = await canvasApi.exportPdf(canvasId, blob)
      const url = res.data.data.url
      // Download
      const a = document.createElement('a')
      a.href = url
      a.download = `${canvasTitle || 'canvas'}.pdf`
      a.click()
    } catch (err) {
      console.error('Export xətası:', err)
      alert('Export zamanı xəta baş verdi')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Yüklənir...</div>
      </div>
    )
  }

  const canvasWidth = pdfOpen
    ? Math.floor(containerSize.width * 0.58)
    : containerSize.width

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <a href="/dashboard"
          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
          <ArrowLeft size={18} />
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
        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden"
          style={{ width: pdfOpen ? '58%' : '100%' }}
        >
          {containerSize.width > 0 && (
            <CanvasBoard
              width={canvasWidth}
              height={containerSize.height}
            />
          )}
        </div>

        {/* PDF Panel */}
        {pdfOpen && pdfUrl && (
          <div className="border-l border-gray-800 overflow-hidden" style={{ width: '42%' }}>
            <PDFViewer
              bookId={bookId || canvas?.book_id || ''}
              fileUrl={pdfUrl}
            />
          </div>
        )}

        {/* PDF açıq amma URL yoxdur */}
        {pdfOpen && !pdfUrl && (
          <div className="border-l border-gray-800 flex items-center justify-center bg-gray-900"
            style={{ width: '42%' }}>
            <div className="text-center text-gray-500 p-6">
              <p className="mb-3 text-sm">Kitab seçilməyib</p>
              <a href="/dashboard"
                className="text-blue-400 hover:text-blue-300 text-sm">
                Dashboard-dan kitab seç
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
