import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, FileDown } from 'lucide-react'
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

  const [canvas,        setCanvas]        = useState<Canvas | null>(null)
  const [canvasTitle,   setCanvasTitle]   = useState('')
  const [pdfOpen,       setPdfOpen]       = useState(false)
  const [pdfUrl,        setPdfUrl]        = useState('')
  const [pdfWidth,      setPdfWidth]      = useState(420)
  const [loading,       setLoading]       = useState(true)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [isDraggingPdf, setIsDraggingPdf] = useState(false)

  const containerRef   = useRef<HTMLDivElement>(null)
  const canvasBoardRef = useRef<CanvasBoardHandle>(null)
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useAutoSave(canvasId || '')
  useKeyboard()

  useEffect(() => {
    if (loading) return
    const update = () => {
      if (containerRef.current) {
        setContainerSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight })
      }
    }
    const raf = requestAnimationFrame(() => {
      update()
      const obs = new ResizeObserver(update)
      if (containerRef.current) obs.observe(containerRef.current)
      ;(containerRef as any)._obs = obs
    })
    return () => { cancelAnimationFrame(raf); (containerRef as any)._obs?.disconnect() }
  }, [loading, pdfOpen])

  useEffect(() => {
    if (!canvasId) return
    const load = async () => {
      try {
        const canvasRes = await canvasApi.getById(canvasId)
        const c = canvasRes.data.data
        setCanvas(c)
        setCanvasTitle(c.title)
        await loadPages(canvasId)
      } catch (err) {
        console.error('Canvas yüklənmədi:', err)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [canvasId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const loadBook = async (id: string) => {
      try {
        const res = await booksApi.getById(id)
        setCurrentBook(res.data.data)
        setPdfUrl(booksApi.getFileUrl(id))
        setPdfOpen(true)
      } catch {}
    }
    if (bookId) void loadBook(bookId)
    else if (canvas?.book_id) void loadBook(canvas.book_id)
  }, [bookId, canvas]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleTitleChange = (title: string) => {
    setCanvasTitle(title)
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
    titleSaveTimer.current = setTimeout(() => {
      if (canvasId) canvasApi.updateTitle(canvasId, title).catch(() => {})
    }, 1000)
  }

  const handleExport = async () => {
    if (!canvasId || !canvasBoardRef.current) return
    try {
      const dataUrl = canvasBoardRef.current.exportImage()
      if (!dataUrl) { alert('Canvas boşdur'); return }
      const img = new window.Image()
      img.src = dataUrl
      await new Promise<void>((res) => { img.onload = () => res() })
      const w = img.width / 2
      const h = img.height / 2
      const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h], hotfixes: ['px_scaling'] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
      const blob = pdf.output('blob')
      try {
        const res = await canvasApi.exportPdf(canvasId, blob)
        const url = res.data.data.url
        const a = document.createElement('a')
        a.href = url; a.download = `${canvasTitle || 'canvas'}.pdf`; a.target = '_blank'; a.click()
      } catch {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${canvasTitle || 'canvas'}.pdf`; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (err) {
      console.error('Export xətası:', err)
      alert('Export zamanı xəta baş verdi')
    }
  }

  if (loading) {
    return (
        <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 28, border: '2.5px solid #334155', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ color: '#475569', fontSize: 13 }}>Yüklənir...</span>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    )
  }

  return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f1f5f9' }}>

        {/* Header — tünd, minimal */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', height: 46,
          background: '#0f172a', borderBottom: '1px solid #1e293b', flexShrink: 0,
        }}>
          {/* Sol: geri + logo + canvas adı */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <a href="/dashboard" style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7, color: '#64748b', textDecoration: 'none', flexShrink: 0,
            }}
               onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#1e293b'; (e.currentTarget as HTMLElement).style.color = '#e2e8f0' }}
               onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#64748b' }}>
              <ArrowLeft size={15} />
            </a>

            <div style={{ width: 1, height: 16, background: '#1e293b', flexShrink: 0 }} />

            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>

            <input
                value={canvasTitle}
                onChange={e => handleTitleChange(e.target.value)}
                style={{
                  background: 'transparent', color: '#e2e8f0', fontSize: 13, fontWeight: 600,
                  border: 'none', borderBottom: '1.5px solid transparent', outline: 'none',
                  padding: '2px 4px', transition: 'border-color .15s', minWidth: 120, maxWidth: 260,
                }}
                onFocus={e => e.target.style.borderBottomColor = '#6366f1'}
                onBlur={e => e.target.style.borderBottomColor = 'transparent'}
                placeholder="Canvas adı"
            />

            <span style={{ fontSize: 16, color: isDirty ? '#f59e0b' : '#334155', lineHeight: 1 }}
                  title={isDirty ? 'Saxlanmamış dəyişikliklər' : 'Saxlanıldı'}>
            {isDirty ? '●' : '✓'}
          </span>
          </div>

          {/* Sağ: PDF + İxrac */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setPdfOpen(v => !v)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 28,
              borderRadius: 7, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: pdfOpen ? '#6366f1' : '#1e293b', color: pdfOpen ? 'white' : '#94a3b8',
              transition: 'all .12s',
            }}>
              <BookOpen size={13} /> PDF
            </button>
            <button onClick={handleExport} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 28,
              borderRadius: 7, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
              background: '#10b981', color: 'white', transition: 'all .12s',
            }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#059669'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#10b981'}>
              <FileDown size={13} /> İxrac
            </button>
          </div>
        </div>

        {/* Main area */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Page sidebar — sol tərəf */}
          {canvasId && <PageSidebar canvasId={canvasId} />}

          {/* LeftPanel (Properties) */}
          <LeftPanel />

          {/* Canvas area */}
          <div ref={containerRef} style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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
              position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
              zIndex: 30, pointerEvents: 'none',
            }}>
              <div style={{ pointerEvents: 'all' }}>
                <Toolbar
                    onExport={handleExport}
                    onTogglePdf={() => setPdfOpen(v => !v)}
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
                    onMouseDown={e => {
                      e.preventDefault()
                      setIsDraggingPdf(true)
                      const startX = e.clientX
                      const startW = pdfWidth
                      const onMove = (ev: MouseEvent) => setPdfWidth(Math.max(280, Math.min(900, startW + (startX - ev.clientX))))
                      const onUp = () => { setIsDraggingPdf(false); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                    style={{
                      width: 5, flexShrink: 0, cursor: 'col-resize',
                      background: isDraggingPdf ? '#6366f1' : 'transparent',
                      borderLeft: '1px solid #e2e8f0', position: 'relative', zIndex: 10,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#6366f1'}
                    onMouseLeave={e => { if (!isDraggingPdf) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                />
                <div style={{ position: 'relative', overflow: 'hidden', flexShrink: 0, width: pdfWidth }}>
                  {isDraggingPdf && <div style={{ position: 'absolute', inset: 0, zIndex: 50, cursor: 'col-resize' }} />}
                  <PDFViewer bookId={bookId || canvas?.book_id || ''} fileUrl={pdfUrl} />
                </div>
              </>
          )}

          {pdfOpen && !pdfUrl && (
              <div style={{ width: 420, borderLeft: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexShrink: 0 }}>
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                  <p style={{ fontSize: 13, marginBottom: 12 }}>Kitab seçilməyib</p>
                  <a href="/dashboard" style={{ color: '#6366f1', fontSize: 13, textDecoration: 'none' }}>Dashboard-dan kitab seç</a>
                </div>
              </div>
          )}
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
  )
}