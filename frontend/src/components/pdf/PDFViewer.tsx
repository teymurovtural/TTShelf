import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { booksApi } from '../../api/books'
import { useBookStore } from '../../store/bookStore'
import type { Annotation } from '../../types'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url,
).toString()

interface PDFViewerProps {
  bookId: string
  fileUrl: string
}

const HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4', '#fdba74']

export default function PDFViewer({ bookId, fileUrl }: PDFViewerProps) {
  const { currentPage, setCurrentPage } = useBookStore()
  const [numPages, setNumPages] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0])
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [pdfBlob, setPdfBlob] = useState<string | null>(null)
  const [inputPage, setInputPage] = useState(String(currentPage))
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  // PDF-i token ilə yüklə
  useEffect(() => {
    if (!fileUrl) return
    const token = localStorage.getItem('access_token')
    fetch(fileUrl, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('PDF yüklənmədi')
        return res.blob()
      })
      .then((blob) => {
        setPdfBlob(URL.createObjectURL(blob))
      })
      .catch((err) => console.error('PDF fetch xətası:', err))
  }, [fileUrl])

  // Annotationları yüklə
  useEffect(() => {
    if (!bookId) return
    booksApi.getAnnotations(bookId)
      .then((res) => setAnnotations(res.data.data || []))
      .catch(() => {})
  }, [bookId])

  useEffect(() => {
    setInputPage(String(currentPage))
  }, [currentPage])

  const onDocumentLoad = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  const goToPage = useCallback((page: number) => {
    const clamped = Math.min(Math.max(page, 1), numPages || 1)
    setCurrentPage(clamped)
    setInputPage(String(clamped))
    booksApi.updateBookmark(bookId, clamped).catch(() => {})
  }, [numPages, bookId])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) return // zoom üçün
    if (e.deltaY > 50) goToPage(currentPage + 1)
    else if (e.deltaY < -50) goToPage(currentPage - 1)
  }, [currentPage, goToPage])

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pageRef.current) return
    const rect = pageRef.current.getBoundingClientRect()
    startPos.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    setIsSelecting(true)
    setSelectionRect(null)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPos.current || !pageRef.current) return
    const rect = pageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setSelectionRect({
      x: Math.min(x, startPos.current.x),
      y: Math.min(y, startPos.current.y),
      w: Math.abs(x - startPos.current.x),
      h: Math.abs(y - startPos.current.y),
    })
  }

  const handleMouseUp = async () => {
    setIsSelecting(false)
    if (!selectionRect || selectionRect.w < 10 || selectionRect.h < 10) {
      setSelectionRect(null)
      return
    }
    try {
      const res = await booksApi.createAnnotation(bookId, {
        page_number: currentPage,
        x: selectionRect.x / scale,
        y: selectionRect.y / scale,
        width: selectionRect.w / scale,
        height: selectionRect.h / scale,
        color: selectedColor,
      })
      setAnnotations((prev) => [...prev, res.data.data])
    } catch (err) {
      console.error('Annotation xətası:', err)
    }
    setSelectionRect(null)
    startPos.current = null
  }

  const deleteAnnotation = async (id: string) => {
    await booksApi.deleteAnnotation(bookId, id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }

  const pageAnnotations = annotations.filter((a) => a.page_number === currentPage)

  if (!pdfBlob) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-950">
        <div className="text-gray-400 text-sm">PDF yüklənir...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex gap-1">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                selectedColor === c ? 'border-white scale-110' : 'border-transparent'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))}
          className="p-1 text-gray-400 hover:text-white"><ZoomOut size={16} /></button>
        <span className="text-xs text-gray-400 w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(s + 0.2, 3))}
          className="p-1 text-gray-400 hover:text-white"><ZoomIn size={16} /></button>
        <div className="w-px h-4 bg-gray-700 mx-1" />
        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
          <ChevronLeft size={16} />
        </button>
        <input
          type="number"
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onBlur={() => goToPage(parseInt(inputPage) || currentPage)}
          onKeyDown={(e) => e.key === 'Enter' && goToPage(parseInt(inputPage) || currentPage)}
          className="w-12 text-center text-xs bg-gray-800 text-white rounded px-1 py-0.5 outline-none"
          min={1}
          max={numPages}
        />
        <span className="text-xs text-gray-500">/ {numPages}</span>
        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}
          className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* PDF Content */}
      <div
        className="flex-1 overflow-auto flex justify-center py-4 px-2"
        onWheel={handleWheel}
      >
        <Document
          file={pdfBlob}
          onLoadSuccess={onDocumentLoad}
          loading={<div className="text-gray-400 text-sm mt-8">Yüklənir...</div>}
          error={<div className="text-red-400 text-sm mt-8">PDF açıla bilmədi</div>}
        >
          <div
            ref={pageRef}
            className="relative select-none shadow-2xl"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              loading={
                <div className="bg-white flex items-center justify-center"
                  style={{ width: 595 * scale, height: 842 * scale }}>
                  <span className="text-gray-400 text-sm">Yüklənir...</span>
                </div>
              }
            />
            {pageAnnotations.map((ann) => (
              <div
                key={ann.id}
                onDoubleClick={() => deleteAnnotation(ann.id)}
                title="Çift tıkla: sil"
                className="absolute rounded cursor-pointer hover:opacity-60 transition-opacity"
                style={{
                  left: ann.x * scale, top: ann.y * scale,
                  width: ann.width * scale, height: ann.height * scale,
                  background: ann.color, opacity: 0.4,
                }}
              />
            ))}
            {selectionRect && (
              <div
                className="absolute pointer-events-none rounded"
                style={{
                  left: selectionRect.x, top: selectionRect.y,
                  width: selectionRect.w, height: selectionRect.h,
                  background: selectedColor, opacity: 0.4,
                  border: `2px solid ${selectedColor}`,
                }}
              />
            )}
          </div>
        </Document>
      </div>
    </div>
  )
}
