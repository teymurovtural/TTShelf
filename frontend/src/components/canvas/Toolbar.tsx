import {
    MousePointer2, Hand, Square, Circle, ArrowRight,
    Type, ImageIcon, Minus, Pencil, Trash2, Undo2, Redo2,
    Download, BookOpen, ChevronDown, Group, Ungroup, Eraser,
} from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import { usePageStore } from '../../store/pageStore'
import { uploadApi } from '../../api/upload'
import { v4 as uuidv4 } from 'uuid'
import type { ElementType } from '../../types'
import { A4_W_PT, A4_H_PT, GRID_COLS, GRID_PAGE_GAP } from './CanvasBoard'

type Tool = ElementType | 'select' | 'pan' | 'eraser'

const SHAPE_TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'rect',          icon: <Square size={15} />,               label: 'Düzbucaqlı (R)' },
    { id: 'circle',        icon: <Circle size={15} />,               label: 'Dairə (C)' },
    { id: 'triangle',      icon: <span style={{ fontSize: 15 }}>△</span>, label: 'Üçbucaq' },
    { id: 'diamond',       icon: <span style={{ fontSize: 15 }}>◇</span>, label: 'Romb' },
    { id: 'pentagon',      icon: <span style={{ fontSize: 15 }}>⬠</span>, label: 'Beşbucaq' },
    { id: 'hexagon',       icon: <span style={{ fontSize: 15 }}>⬡</span>, label: 'Altıbucaq' },
    { id: 'star',          icon: <span style={{ fontSize: 15 }}>★</span>, label: 'Ulduz' },
    { id: 'parallelogram', icon: <span style={{ fontSize: 13 }}>▱</span>, label: 'Paraleloqram' },
    { id: 'cross',         icon: <span style={{ fontSize: 15 }}>✚</span>, label: 'Xaç' },
    { id: 'cylinder',      icon: <span style={{ fontSize: 13 }}>⊙</span>, label: 'Silindr' },
]

const MAIN_TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: 'select',   icon: <MousePointer2 size={16} />, label: 'Seç (V)'       },
    { id: 'pan',      icon: <Hand size={16} />,          label: 'Sürüşdür (H)'  },
    { id: 'line',     icon: <Minus size={16} />,         label: 'Xətt (L)'      },
    { id: 'arrow',    icon: <ArrowRight size={16} />,    label: 'Ok (A)'        },
    { id: 'text',     icon: <Type size={16} />,          label: 'Mətn (T)'      },
    { id: 'freehand', icon: <Pencil size={16} />,        label: 'Çizgi (P)'     },
    { id: 'eraser',   icon: <Eraser size={16} />,        label: 'Silgi (E)'     },
]

interface ToolbarProps {
    onExport: () => void
    onTogglePdf: () => void
    pdfOpen: boolean
    isDirty: boolean
    canvasTitle: string
    onTitleChange: (t: string) => void
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="tooltip-container">
            {children}
            <span className="tooltip">{label}</span>
        </div>
    )
}

export default function Toolbar({
                                    onExport, onTogglePdf, pdfOpen, isDirty, canvasTitle, onTitleChange,
                                }: ToolbarProps) {
    const {
        tool, setTool, selectedIds, deleteSelected, undo, redo,
        groupSelected, ungroupSelected, addElement, setElements,
        eraserSize, setEraserSize, elements, updateElement,
    } = useCanvasStore()
    const { activePageId, pages } = usePageStore()

    const imageInputRef = useRef<HTMLInputElement>(null)
    const [shapeOpen, setShapeOpen]   = useState(false)
    const shapeRef    = useRef<HTMLDivElement>(null)

    const currentTool = tool as Tool

    useEffect(() => {
        const close = (e: MouseEvent) => {
            if (shapeRef.current && !shapeRef.current.contains(e.target as Node)) {
                setShapeOpen(false)
            }
        }
        document.addEventListener('mousedown', close)
        return () => document.removeEventListener('mousedown', close)
    }, [])

    const isShapeActive = SHAPE_TOOLS.some((s) => s.id === currentTool)
    const currentShapeIcon = SHAPE_TOOLS.find((s) => s.id === currentTool)?.icon ?? <Square size={15} />

    return (
        <div className="flex items-center gap-2 flex-1 min-w-0">

            {/* Canvas başlığı + save indicator */}
            <div className="flex items-center gap-1.5 min-w-0">
                <input
                    value={canvasTitle}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="canvas-title-input"
                    placeholder="Canvas adı"
                />
                <Tip label={isDirty ? 'Saxlanmamış dəyişikliklər' : 'Saxlanıldı'}>
          <span className={`text-sm select-none ${isDirty ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isDirty ? '●' : '✓'}
          </span>
                </Tip>
            </div>

            {/* ── Əsas floating toolbar ── */}
            <div className="ftoolbar">
                {/* Əsas alətlər */}
                {MAIN_TOOLS.map((t) => (
                    <Tip key={t.id} label={t.label}>
                        <button
                            onClick={() => setTool(t.id as ElementType | 'select' | 'pan')}
                            className={`ftoolbar-btn ${currentTool === t.id ? 'active' : ''}`}
                        >
                            {t.icon}
                        </button>
                    </Tip>
                ))}

                <div className="ftoolbar-divider" />

                {/* Shape dropdown */}
                <div className="relative" ref={shapeRef}>
                    <Tip label="Fiqurlar">
                        <button
                            onClick={() => setShapeOpen((v) => !v)}
                            className={`ftoolbar-btn ${isShapeActive ? 'active' : ''}`}
                            style={{ width: 44 }}
                        >
                            {currentShapeIcon}
                            <ChevronDown size={9} style={{ marginLeft: 1, opacity: 0.7 }} />
                        </button>
                    </Tip>
                    {shapeOpen && (
                        <div
                            className="shape-dropdown"
                            style={{
                                position: 'absolute',
                                top: '100%',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                marginTop: 6,
                            }}
                        >
                            {SHAPE_TOOLS.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => { setTool(s.id as ElementType); setShapeOpen(false) }}
                                    title={s.label}
                                    className={`shape-dropdown-btn ${currentTool === s.id ? 'active' : ''}`}
                                >
                                    {s.icon}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Şəkil yüklə */}
                <Tip label="Şəkil əlavə et (I)">
                    <button
                        onClick={() => imageInputRef.current?.click()}
                        className="ftoolbar-btn"
                    >
                        <ImageIcon size={16} />
                    </button>
                </Tip>

                <div className="ftoolbar-divider" />

                {/* Eraser ölçüsü — yalnız eraser seçiləndə görünür */}
                {currentTool === 'eraser' && (
                    <>
                        <div className="flex items-center gap-1.5 px-1" style={{ minWidth: 120 }}>
                            <Eraser size={11} className="text-gray-400 shrink-0" />
                            <input
                                type="range"
                                min={5}
                                max={80}
                                step={1}
                                value={eraserSize}
                                onChange={e => setEraserSize(Number(e.target.value))}
                                className="flex-1"
                                style={{ accentColor: '#6366f1', height: 3, cursor: 'pointer' }}
                            />
                            <span className="text-gray-400 shrink-0" style={{ fontSize: 10, minWidth: 22 }}>
                                {eraserSize}
                            </span>
                        </div>
                        <div className="ftoolbar-divider" />
                    </>
                )}

                {/* Dash slider */}
                {selectedIds.length === 1 && (() => {
                    const el = elements.find(e => e.id === selectedIds[0])
                    if (!el || !['line','arrow','freehand'].includes(el.type)) return null
                    const dashVal = el.data.dash ? el.data.dash[0] : 0
                    const gapVal  = el.data.dash ? el.data.dash[1] : 0
                    return (
                        <>
                            <div className="ftoolbar-divider" />
                            <div style={{ display:"flex", flexDirection:"column", gap:4, padding:"0 6px", minWidth:130 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <span style={{ fontSize:10, color:"#9090b0", minWidth:28 }}>Xətt</span>
                                    <input type="range" min={0} max={40} step={1} value={dashVal}
                                           onChange={e => { const v=Number(e.target.value); updateElement(el.id, { dash: v===0 ? undefined : [v, gapVal||v] } as any) }}
                                           style={{ flex:1, accentColor:"#6366f1", height:3, cursor:"pointer" }} />
                                    <span style={{ fontSize:10, color:"#9090b0", minWidth:20, textAlign:"right" }}>{dashVal}</span>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                    <span style={{ fontSize:10, color:"#9090b0", minWidth:28 }}>Boşluq</span>
                                    <input type="range" min={0} max={40} step={1} value={gapVal}
                                           onChange={e => { const v=Number(e.target.value); updateElement(el.id, { dash: dashVal===0 ? undefined : [dashVal, v] } as any) }}
                                           style={{ flex:1, accentColor:"#6366f1", height:3, cursor:"pointer" }} />
                                    <span style={{ fontSize:10, color:"#9090b0", minWidth:20, textAlign:"right" }}>{gapVal}</span>
                                </div>
                            </div>
                        </>
                    )
                })()}

                {/* Undo / Redo */}
                <Tip label="Geri al (Ctrl+Z)">
                    <button onClick={undo} className="ftoolbar-btn"><Undo2 size={16} /></button>
                </Tip>
                <Tip label="İrəli al (Ctrl+Y)">
                    <button onClick={redo} className="ftoolbar-btn"><Redo2 size={16} /></button>
                </Tip>

                {/* Sil butonu — seçim varsa */}
                {selectedIds.length > 0 && (
                    <>
                        <div className="ftoolbar-divider" />
                        {selectedIds.length > 1 && (
                            <>
                                <Tip label="Qruplaşdır (Ctrl+G)">
                                    <button onClick={groupSelected} className="ftoolbar-btn">
                                        <Group size={16} />
                                    </button>
                                </Tip>
                                <Tip label="Qrupu aç (Ctrl+Shift+G)">
                                    <button onClick={ungroupSelected} className="ftoolbar-btn">
                                        <Ungroup size={16} />
                                    </button>
                                </Tip>
                            </>
                        )}
                        <Tip label="Sil (Delete)">
                            <button onClick={deleteSelected} className="ftoolbar-btn danger">
                                <Trash2 size={16} />
                            </button>
                        </Tip>
                    </>
                )}
            </div>

            {/* Canvas sıfırla */}
            <Tip label="Bütün elementləri sil">
                <button
                    onClick={() => {
                        if (confirm('Canvas-dakı bütün elementlər silinəcək. Davam?')) setElements([])
                    }}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 transition-all shrink-0"
                >
                    Sıfırla
                </button>
            </Tip>

            <div className="flex-1" />

            {/* Export */}
            <button
                onClick={onExport}
                title="PDF kimi ixrac et"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all shadow-sm shrink-0"
            >
                <Download size={15} />
                İxrac
            </button>

            {/* Gizli image input */}
            <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    e.target.value = ''
                    try {
                        const res = await uploadApi.image(file)
                        const url = res.data.data.url
                        const img = new window.Image()
                        img.src = url
                        img.onload = () => {
                            // Şəkli aktiv page-in öz sahəsinin içində yerləşdir —
                            // əvvəllər həmişə qlobal (100,100) qoyulurdu ki, bu, çoxsəhifəli
                            // görünüşdə page1-in üstünə düşürdü, page_id isə activePageId olurdu.
                            const pageIdx = pages.findIndex(p => p.id === activePageId)
                            const col = pageIdx >= 0 ? pageIdx % GRID_COLS : 0
                            const row = pageIdx >= 0 ? Math.floor(pageIdx / GRID_COLS) : 0
                            const pageOffsetX = col * (A4_W_PT + GRID_PAGE_GAP)
                            const pageOffsetY = row * (A4_H_PT + GRID_PAGE_GAP)
                            addElement({
                                id: uuidv4(), canvas_id: '', page_id: activePageId || '', type: 'image',
                                data: {
                                    x: pageOffsetX + 100, y: pageOffsetY + 100,
                                    width:  Math.min(img.width  / 2, 600),
                                    height: Math.min(img.height / 2, 600),
                                    src: url,
                                },
                                z_index: Date.now(),
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                        }
                    } catch (err) { console.error('Image upload:', err) }
                }}
            />
        </div>
    )
}