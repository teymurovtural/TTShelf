import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ZoomIn, ZoomOut, RefreshCw, ExternalLink, Layers } from 'lucide-react'
import { booksApi } from '../../api/books'
import { useBookStore } from '../../store/bookStore'
import type { Annotation } from '../../types'
import { getCachedPdf, setCachedPdf } from '../../utils/pdfCache'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url,
).toString()

interface PDFViewerProps {
    bookId:  string
    fileUrl: string
}

const COLORS = [
    { id: 'yellow', bg: 'rgba(253,224,71,0.45)',  border: '#ca8a04' },
    { id: 'green',  bg: 'rgba(134,239,172,0.45)', border: '#16a34a' },
    { id: 'blue',   bg: 'rgba(147,197,253,0.45)', border: '#2563eb' },
    { id: 'pink',   bg: 'rgba(249,168,212,0.45)', border: '#db2777' },
    { id: 'orange', bg: 'rgba(253,186,116,0.45)', border: '#ea580c' },
]
type Color = typeof COLORS[0]

// ─── Highlight overlay — memo, yalnız annotations/scale dəyişəndə render ────
interface OverlayProps {
    annotations: Annotation[]
    scale:       number
    numPages:    number
    onDelete:    (id: string) => void
    pageRefs:    React.MutableRefObject<(HTMLDivElement | null)[]>
    scrollRef:   React.RefObject<HTMLDivElement>
    onMouseUp:   (pageNum: number, pageEl: HTMLDivElement) => void
}

const HighlightOverlay = memo(function HighlightOverlay({
                                                            annotations, scale, numPages, onDelete, pageRefs, scrollRef, onMouseUp,
                                                        }: OverlayProps) {
    return (
        <div
            ref={scrollRef as React.RefObject<HTMLDivElement>}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#525659' }}
        >
            <Document
                file={null as unknown as string}   // dummy — sadəcə Page-ləri render etmək üçün
                loading={null}
            >
                {Array.from({ length: numPages }, (_, i) => {
                    const pageNum  = i + 1
                    const pageAnns = annotations.filter(a => a.page_number === pageNum)
                    return (
                        <div
                            key={pageNum}
                            ref={el => { pageRefs.current[i] = el }}
                            data-page={pageNum}
                            style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}
                        >
                            <div
                                style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}
                                onMouseUp={e => {
                                    const pageDiv = e.currentTarget.querySelector('.react-pdf__Page') as HTMLDivElement | null
                                    if (pageDiv) onMouseUp(pageNum, pageDiv)
                                }}
                            >
                                <Page
                                    pageNumber={pageNum}
                                    scale={scale}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    loading={
                                        <div style={{
                                            width:  Math.round(595 * scale),
                                            height: Math.round(842 * scale),
                                            background: '#fff',
                                        }} />
                                    }
                                />
                                {pageAnns.map(ann => (
                                    <div
                                        key={ann.id}
                                        title={ann.note ? `${ann.note}\n\nSilmək: iki dəfə klik` : 'Sil: iki dəfə klik'}
                                        onDoubleClick={() => onDelete(ann.id)}
                                        style={{
                                            position:     'absolute',
                                            left:         ann.x      * scale,
                                            top:          ann.y      * scale,
                                            width:        ann.width  * scale,
                                            height:       ann.height * scale,
                                            background:   ann.color,
                                            mixBlendMode: 'multiply',
                                            cursor:       'pointer',
                                            pointerEvents:'all',
                                            borderRadius: 2,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}
            </Document>
        </div>
    )
})

// ─── Ana komponent ────────────────────────────────────────────────────────────
export default function PDFViewer({ bookId, fileUrl }: PDFViewerProps) {
    const { currentPage, setCurrentPage, currentBook } = useBookStore()

    // İki mode: 'native' = iframe, 'annotate' = react-pdf (highlight mode)
    const [mode,         setMode]         = useState<'native' | 'annotate'>('native')
    const [iframeSrc,    setIframeSrc]    = useState<string | null>(null)
    const [pdfBlob,      setPdfBlob]      = useState<string | null>(null)
    const [numPages,     setNumPages]     = useState(0)
    const [scale,        setScale]        = useState(1.2)
    const [loadError,    setLoadError]    = useState<string | null>(null)
    const [fetching,     setFetching]     = useState(false)
    const [annotations,  setAnnotations]  = useState<Annotation[]>([])
    const [activeColor,  setActiveColor]  = useState(COLORS[0])
    const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set())

    const scrollRef   = useRef<HTMLDivElement>(null)
    const pageRefs    = useRef<(HTMLDivElement | null)[]>([])
    const blobRef     = useRef<string | null>(null)
    const observerRef = useRef<IntersectionObserver | null>(null)
    const didScrollRef = useRef(false)

    // ── iframe src — token query param ilə ───────────────────────
    useEffect(() => {
        if (!fileUrl) return
        const token = localStorage.getItem('access_token')
        // fileUrl: /api/v1/books/:id/file
        setIframeSrc(`${fileUrl}?token=${token}`)
    }, [fileUrl])

    // ── blob cache — annotate mode üçün ──────────────────────────
    const makeBlobUrl = useCallback((buffer: ArrayBuffer) => {
        if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
        const url = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }))
        blobRef.current = url
        return url
    }, [])

    const loadBlob = useCallback(async () => {
        if (pdfBlob) return  // artıq yüklənib
        const cached = await getCachedPdf(bookId)
        if (cached) { setPdfBlob(makeBlobUrl(cached)); return }

        setFetching(true)
        try {
            const token = localStorage.getItem('access_token')
            const res   = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const buffer = await res.arrayBuffer()
            if (!buffer.byteLength) throw new Error('PDF boşdur')
            setCachedPdf(bookId, buffer)
            setPdfBlob(makeBlobUrl(buffer))
        } catch (e: unknown) {
            setLoadError(e instanceof Error ? e.message : 'Xəta')
        } finally { setFetching(false) }
    }, [bookId, fileUrl, pdfBlob, makeBlobUrl])

    useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current) }, [])

    // Annotate mode-a keçəndə blob-u yüklə
    useEffect(() => {
        if (mode === 'annotate') loadBlob()
    }, [mode, loadBlob])

    // ── Annotasiyaları yüklə ──────────────────────────────────────
    useEffect(() => {
        if (!bookId) return
        booksApi.getAnnotations(bookId)
            .then(r => setAnnotations(r.data.data || []))
            .catch(() => {})
    }, [bookId])

    // ── PDF yükləndikdə ───────────────────────────────────────────
    const handleDocLoad = useCallback(({ numPages: n }: { numPages: number }) => {
        setNumPages(n)
        didScrollRef.current = false
        if (scrollRef.current) {
            const w = scrollRef.current.offsetWidth
            if (w > 0) setScale(parseFloat(((w - 32) / 595).toFixed(3)))
        }
    }, [])

    // ── last_page-ə scroll ────────────────────────────────────────
    useEffect(() => {
        if (didScrollRef.current || mode !== 'annotate') return
        const target = currentBook?.last_page ?? 1
        if (target <= 1 || numPages === 0) return
        const el = pageRefs.current[target - 1]
        if (!el) return
        didScrollRef.current = true
        setTimeout(() => el.scrollIntoView({ behavior: 'auto', block: 'start' }), 120)
    }, [numPages, renderedPages, currentBook, mode])

    // ── IntersectionObserver ──────────────────────────────────────
    useEffect(() => {
        observerRef.current?.disconnect()
        if (!scrollRef.current || numPages === 0 || mode !== 'annotate') return
        let timer: ReturnType<typeof setTimeout> | null = null
        observerRef.current = new IntersectionObserver(entries => {
            let best: { page: number; ratio: number } | null = null
            entries.forEach(e => {
                const p = parseInt((e.target as HTMLElement).dataset.page ?? '0')
                if (p && e.intersectionRatio > (best?.ratio ?? 0))
                    best = { page: p, ratio: e.intersectionRatio }
            })
            if (best && (best as { page: number; ratio: number }).ratio > 0.15) {
                const p = (best as { page: number; ratio: number }).page
                setCurrentPage(p)
                if (timer) clearTimeout(timer)
                timer = setTimeout(() => booksApi.updateBookmark(bookId, p).catch(() => {}), 1500)
            }
        }, { root: scrollRef.current, threshold: [0.15, 0.5] })
        pageRefs.current.slice(0, numPages).forEach(el => {
            if (el) observerRef.current!.observe(el)
        })
        return () => { observerRef.current?.disconnect(); if (timer) clearTimeout(timer) }
    }, [numPages, bookId, setCurrentPage, mode])

    // ── Text seçim → highlight ────────────────────────────────────
    const handleMouseUp = useCallback(async (pageNum: number, pageEl: HTMLDivElement) => {
        const sel = window.getSelection()
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) return
        const selectedText = sel.toString().trim()
        if (!selectedText) return
        const pageRect = pageEl.getBoundingClientRect()
        const rects    = Array.from(sel.getRangeAt(0).getClientRects())
        if (!rects.length) return
        const created: Annotation[] = []
        for (const r of rects) {
            if (r.width < 2 || r.height < 2) continue
            try {
                const res = await booksApi.createAnnotation(bookId, {
                    page_number: pageNum,
                    x:      (r.left - pageRect.left) / scale,
                    y:      (r.top  - pageRect.top)  / scale,
                    width:  r.width  / scale,
                    height: r.height / scale,
                    color:  activeColor.bg,
                    note:   selectedText,
                })
                created.push(res.data.data)
            } catch {}
        }
        setAnnotations(prev => [...prev, ...created])
        sel.removeAllRanges()
    }, [bookId, scale, activeColor])

    const handleDeleteAnn = useCallback(async (id: string) => {
        await booksApi.deleteAnnotation(bookId, id)
        setAnnotations(prev => prev.filter(a => a.id !== id))
    }, [bookId])

    const zoomFit = () => {
        if (scrollRef.current) {
            const w = scrollRef.current.offsetWidth
            if (w > 0) setScale(parseFloat(((w - 32) / 595).toFixed(3)))
        }
    }

    return (
        <div className="flex flex-col h-full">

            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">

                <button
                    onClick={() => setMode(m => m === 'native' ? 'annotate' : 'native')}
                    title={mode === 'native' ? 'Highlight modu aç' : 'Normal oxuma moduna qayıt'}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
                        mode === 'annotate'
                            ? 'bg-indigo-100 text-indigo-600 border border-indigo-300'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                >
                    <Layers size={13}/>
                    Highlight
                </button>

                {mode === 'annotate' && (
                    <div className="flex gap-1.5 items-center">
                        {COLORS.map(c => (
                            <button key={c.id} onClick={() => setActiveColor(c)} title={c.id}
                                    style={{
                                        width:16, height:16, borderRadius:'50%', background:c.bg, cursor:'pointer',
                                        border: activeColor.id===c.id ? `2px solid ${c.border}` : '1.5px solid #d1d5db',
                                        transform: activeColor.id===c.id ? 'scale(1.2)' : 'scale(1)',
                                        transition:'all 0.1s', flexShrink:0,
                                    }}
                            />
                        ))}
                    </div>
                )}

                <div className="flex-1" />

                {mode === 'annotate' && (
                    <>
                        <button onClick={() => setScale(s => Math.max(+(s-0.1).toFixed(2), 0.3))}
                                className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100">
                            <ZoomOut size={14}/>
                        </button>
                        <span className="text-xs text-gray-500 px-1 min-w-[36px] text-center cursor-pointer hover:text-indigo-500"
                              onClick={zoomFit} title="Enə uyğunlaşdır">
              {Math.round(scale*100)}%
            </span>
                        <button onClick={() => setScale(s => Math.min(+(s+0.1).toFixed(2), 3))}
                                className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100">
                            <ZoomIn size={14}/>
                        </button>
                        <div className="w-px h-4 bg-gray-200 mx-1" />
                        <span className="text-xs text-gray-400 tabular-nums select-none">
              {currentPage} / {numPages||'—'}
            </span>
                        <div className="w-px h-4 bg-gray-200 mx-1" />
                    </>
                )}

                <button onClick={() => iframeSrc && window.open(iframeSrc, '_blank')}
                        title="Yeni tabda aç"
                        className="p-1 text-gray-400 hover:text-indigo-500 rounded hover:bg-gray-100">
                    <ExternalLink size={14}/>
                </button>
                {mode === 'annotate' && (
                    <button onClick={() => { setPdfBlob(null); loadBlob() }} title="Yenidən yüklə"
                            className="p-1 text-gray-400 hover:text-indigo-500 rounded hover:bg-gray-100">
                        <RefreshCw size={14}/>
                    </button>
                )}
            </div>

            {/* ── Native mode: iframe ── */}
            {mode === 'native' && (
                iframeSrc
                    ? <iframe
                        key={iframeSrc}
                        src={iframeSrc}
                        className="flex-1 w-full border-none"
                        title="PDF"
                    />
                    : <div className="flex-1 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                    </div>
            )}

            {/* ── Annotate mode: react-pdf ── */}
            {mode === 'annotate' && (
                <>
                    {fetching && !pdfBlob && (
                        <div className="flex-1 flex items-center justify-center bg-gray-100">
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                                <span className="text-gray-400 text-sm">PDF yüklənir...</span>
                            </div>
                        </div>
                    )}
                    {loadError && (
                        <div className="flex-1 flex items-center justify-center bg-gray-100">
                            <div className="text-center p-4">
                                <p className="text-red-500 text-sm mb-3">{loadError}</p>
                                <button onClick={loadBlob}
                                        className="px-3 py-1.5 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600">
                                    Yenidən cəhd et
                                </button>
                            </div>
                        </div>
                    )}
                    {pdfBlob && (
                        <div
                            ref={scrollRef}
                            style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#525659' }}
                        >
                            <Document
                                file={pdfBlob}
                                onLoadSuccess={handleDocLoad}
                                onLoadError={e => { console.error(e); setLoadError('PDF render edilə bilmədi') }}
                                loading={
                                    <div style={{ height: 128, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', color: '#9ca3af' }}>Yüklənir...</div>
                                }
                            >
                                {Array.from({ length: numPages }, (_, i) => {
                                    const pageNum  = i + 1
                                    const pageAnns = annotations.filter(a => a.page_number === pageNum)
                                    return (
                                        <div
                                            key={pageNum}
                                            ref={el => { pageRefs.current[i] = el }}
                                            data-page={pageNum}
                                            style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}
                                        >
                                            <div
                                                style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}
                                                onMouseUp={e => {
                                                    const pageDiv = e.currentTarget.querySelector('.react-pdf__Page') as HTMLDivElement | null
                                                    if (pageDiv) handleMouseUp(pageNum, pageDiv)
                                                }}
                                            >
                                                <Page
                                                    pageNumber={pageNum}
                                                    scale={scale}
                                                    renderTextLayer={true}
                                                    renderAnnotationLayer={true}
                                                    onRenderSuccess={() =>
                                                        setRenderedPages(prev => new Set([...prev, pageNum]))
                                                    }
                                                    loading={
                                                        <div style={{
                                                            width: Math.round(595 * scale),
                                                            height: Math.round(842 * scale),
                                                            background: '#fff',
                                                        }} />
                                                    }
                                                />
                                                {pageAnns.map(ann => (
                                                    <div
                                                        key={ann.id}
                                                        title={ann.note ? `${ann.note}\n\nSilmək: iki dəfə klik` : 'Sil: iki dəfə klik'}
                                                        onDoubleClick={() => handleDeleteAnn(ann.id)}
                                                        style={{
                                                            position:     'absolute',
                                                            left:         ann.x      * scale,
                                                            top:          ann.y      * scale,
                                                            width:        ann.width  * scale,
                                                            height:       ann.height * scale,
                                                            background:   ann.color,
                                                            mixBlendMode: 'multiply',
                                                            cursor:       'pointer',
                                                            pointerEvents:'all',
                                                            borderRadius: 2,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </Document>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}