import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react'
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
  const [numPages,      setNumPages]      = useState(0)
  const [scale,         setScale]         = useState(1.2)
  const [annotations,   setAnnotations]   = useState<Annotation[]>([])
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0])
  const [isSelecting,   setIsSelecting]   = useState(false)
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [pdfBlob,       setPdfBlob]       = useState<string | null>(null)
  const [inputPage,     setInputPage]     = useState(String(currentPage))
  const [loadError,     setLoadError]     = useState<string | null>(null)
  const [fetching,      setFetching]      = useState(false)

  const startPos = useRef<{ x: number; y: number } | null>(null)
  const pageRef  = useRef<HTMLDivElement>(null)

  const fetchPdf = useCallback(() => {
    if (!fileUrl) return
    setLoadError(null)
    setFetching(true)
    setPdfBlob(null)
    const token = localStorage.getItem('access_token')
    fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error(`Server xətası: ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        if (blob.size === 0) throw new Error('PDF faylı boşdur')
        setPdfBlob(URL.createObjectURL(blob))
      })
      .catch((err) => {
        console.error('PDF fetch:', err)
        setLoadError(err.message || 'PDF yüklənmədi')
      })
      .finally(() => setFetching(false))
  }, [fileUrl])

  useEffect(() => { fetchPdf() }, [fetchPdf])

  useEffect(() => {
    if (!bookId) return
    booksApi.getAnnotations(bookId)
      .then((res) => setAnnotations(res.data.data || []))
      .catch(() => {})
  }, [bookId])

  useEffect(() => { setInputPage(String(currentPage)) }, [currentPage])

  const goToPage = useCallback((page: number) => {
    const clamped = Math.min(Math.max(page, 1), numPages || 1)
    setCurrentPage(clamped)
    setInputPage(String(clamped))
    booksApi.updateBookmark(bookId, clamped).catch(() => {})
  }, [numPages, bookId, setCurrentPage])

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
        width:  selectionRect.w / scale,
        height: selectionRect.h / scale,
        color: selectedColor,
      })
      setAnnotations((prev) => [...prev, res.data.data])
    } catch {}
    setSelectionRect(null)
    startPos.current = null
  }

  const deleteAnnotation = async (id: string) => {
    await booksApi.deleteAnnotation(bookId, id)
    setAnnotations((prev) => prev.filter((a) => a.id !== id))
  }

  const pageAnnotations = annotations.filter((a) => a.page_number === currentPage)

  if (fetching) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-sm">PDF yüklənir...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <div className="text-center p-6">
          <p className="text-red-500 text-sm mb-1">PDF açıla bilmədi</p>
          <p className="text-gray-400 text-xs mb-4">{loadError}</p>
          <button
            onClick={fetchPdf}
            className="flex items-center gap-2 mx-auto px-4 py-2 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors"
          >
            <RefreshCw size={14} />
            Yenidən cəhd et
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex gap-1">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                selectedColor === c ? 'border-gray-600 scale-110' : 'border-transparent'
              }`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => setScale((s) => Math.max(s - 0.2, 0.5))}
          className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all">
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-gray-500 w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(s + 0.2, 3))}
          className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all">
          <ZoomIn size={16} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
          className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all">
          <ChevronLeft size={16} />
        </button>
        <input
          type="number"
          value={inputPage}
          onChange={(e) => setInputPage(e.target.value)}
          onBlur={() => goToPage(parseInt(inputPage) || currentPage)}
          onKeyDown={(e) => e.key === 'Enter' && goToPage(parseInt(inputPage) || currentPage)}
          className="w-12 text-center text-xs border border-gray-200 text-gray-700 rounded-lg px-1 py-1 outline-none focus:border-indigo-400"
          min={1} max={numPages}
        />
        <span className="text-xs text-gray-400">/ {numPages}</span>
        <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}
          className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-auto flex justify-center py-4 px-2 bg-gray-100">
        {pdfBlob && (
          <Document
            file={pdfBlob}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(err) => {
              console.error('PDF render xətası:', err)
              setLoadError('PDF render edilə bilmədi')
              setPdfBlob(null)
            }}
            loading={<div className="text-gray-400 text-sm mt-8">Render olunur...</div>}
          >
            <div
              ref={pageRef}
              className="relative select-none shadow-lg"
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
                  title="Çift klik: sil"
                  className="absolute rounded cursor-pointer hover:opacity-70 transition-opacity"
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
        )}
      </div>
    </div>
  )
}
