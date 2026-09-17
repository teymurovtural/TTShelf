import {
  MousePointer2, Hand, Square, Circle, ArrowRight,
  Type, ImageIcon, Minus, Pencil, Trash2, Undo2, Redo2,
  Download, BookOpen, ChevronDown, Group, Ungroup
} from 'lucide-react'
import { useRef, useState, useEffect } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import { uploadApi } from '../../api/upload'
import { v4 as uuidv4 } from 'uuid'
import type { ElementType } from '../../types'

type Tool = ElementType | 'select' | 'pan'

const SHAPE_TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'rect',        icon: <Square size={14} />,      label: 'Düzbucaqlı' },
  { id: 'circle',      icon: <Circle size={14} />,      label: 'Dairə' },
  { id: 'triangle',    icon: <span style={{fontSize:13}}>△</span>, label: 'Üçbucaq' },
  { id: 'diamond',     icon: <span style={{fontSize:13}}>◇</span>, label: 'Romb' },
  { id: 'pentagon',    icon: <span style={{fontSize:13}}>⬠</span>, label: 'Beşbucaq' },
  { id: 'hexagon',     icon: <span style={{fontSize:13}}>⬡</span>, label: 'Altıbucaq' },
  { id: 'star',        icon: <span style={{fontSize:13}}>★</span>, label: 'Ulduz' },
  { id: 'parallelogram', icon: <span style={{fontSize:11}}>▱</span>, label: 'Paraleloqram' },
  { id: 'cross',       icon: <span style={{fontSize:13}}>✚</span>, label: 'Xaç' },
  { id: 'cylinder',    icon: <span style={{fontSize:11}}>⊙</span>, label: 'Silindr' },
]

const TOOLS: { id: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
  { id: 'select',   icon: <MousePointer2 size={16} />, label: 'Seç',        shortcut: 'V' },
  { id: 'pan',      icon: <Hand size={16} />,          label: 'Sürüşdür',   shortcut: 'H' },
  { id: 'line',     icon: <Minus size={16} />,         label: 'Xətt',       shortcut: 'L' },
  { id: 'arrow',    icon: <ArrowRight size={16} />,    label: 'Ok',         shortcut: 'A' },
  { id: 'text',     icon: <Type size={16} />,          label: 'Mətn',       shortcut: 'T' },
  { id: 'freehand', icon: <Pencil size={16} />,        label: 'Çizgi',      shortcut: 'P' },

]

const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8]

const PRESET_COLORS = [
  '#0f172a', '#1e40af', '#0369a1', '#065f46', '#7c2d12',
  '#6d28d9', '#be185d', '#b45309', '#374151', '#64748b',
  '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#f97316', '#ffffff', 'transparent',
]

interface ToolbarProps {
  onExport: () => void
  onTogglePdf: () => void
  pdfOpen: boolean
  isDirty: boolean
  canvasTitle: string
  onTitleChange: (t: string) => void
}

export default function Toolbar({
  onExport, onTogglePdf, pdfOpen, isDirty, canvasTitle, onTitleChange,
}: ToolbarProps) {
  const { tool, setTool, selectedIds, selectedId, deleteSelected, undo, redo, groupSelected, ungroupSelected, addElement, setElements } = useCanvasStore()
  const [strokeOpen, setStrokeOpen] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [shapeOpen, setShapeOpen] = useState(false)
  const strokeRef = useRef<HTMLDivElement>(null)
  const shapeRef  = useRef<HTMLDivElement>(null)

  // Shape dropdown xaricdə kliklənəndə bağlansın
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (shapeRef.current && !shapeRef.current.contains(e.target as Node)) {
        setShapeOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      {/* Canvas başlığı */}
      <input
        value={canvasTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        className="bg-transparent text-gray-800 text-sm font-semibold outline-none border-b border-transparent
                   hover:border-gray-300 focus:border-indigo-400 px-1 w-40 truncate transition-colors"
        placeholder="Canvas adı"
      />

      {/* Save indicator */}
      <span className={`text-xs mr-1 shrink-0 ${isDirty ? 'text-amber-500' : 'text-gray-300'}`} title={isDirty ? 'Saxlanmamış dəyişikliklər' : 'Saxlanıldı'}>
        {isDirty ? '●' : '✓'}
      </span>

      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

      {/* Əsas alətlər */}
      <div className="flex items-center gap-0.5 shrink-0">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={`${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}`}
            className={`p-2 rounded-lg transition-all ${
              tool === t.id
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            {t.icon}
          </button>
        ))}

        {/* Shape dropdown */}
        <div className="relative" ref={shapeRef}>
          <button
            onClick={() => setShapeOpen((v) => !v)}
            title="Fiqurlar"
            className={`p-2 rounded-lg transition-all flex items-center gap-0.5 ${
              SHAPE_TOOLS.some((s) => s.id === tool)
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            {SHAPE_TOOLS.find((s) => s.id === tool)?.icon ?? <Square size={16} />}
            <ChevronDown size={10} />
          </button>
          {shapeOpen && (
            <div
              className="fixed bg-white border border-gray-200 rounded-xl shadow-xl p-2 grid grid-cols-5 gap-1"
              style={{
                top: (shapeRef.current?.getBoundingClientRect().bottom ?? 0) + 4,
                left: shapeRef.current?.getBoundingClientRect().left ?? 0,
                zIndex: 9999,
              }}
            >
              {SHAPE_TOOLS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setTool(s.id); setShapeOpen(false) }}
                  title={s.label}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-base transition-all ${
                    tool === s.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s.icon}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Şəkil yüklə — birbaşa input açır */}
      <button
        onClick={() => imageInputRef.current?.click()}
        title="Şəkil əlavə et (I)"
        className={`p-2 rounded-lg transition-all ${
          tool === 'image'
            ? 'bg-indigo-600 text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
        }`}
      >
        <ImageIcon size={16} />
      </button>
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
              addElement({
                id: uuidv4(), canvas_id: '', type: 'image',
                data: { x: 100, y: 100, width: Math.min(img.width / 2, 600), height: Math.min(img.height / 2, 600), src: url },
                z_index: Date.now(),
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
              })
            }
          } catch (err) { console.error('Image upload:', err) }
        }}
      />

      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

      {/* Undo / Redo / Sıfırla */}
      <button onClick={undo} title="Geri al (Ctrl+Z)"
        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all shrink-0">
        <Undo2 size={16} />
      </button>
      <button onClick={redo} title="İrəli al (Ctrl+Y)"
        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all shrink-0">
        <Redo2 size={16} />
      </button>
      <button
        onClick={() => {
          if (confirm('Canvas-dakı bütün elementlər silinəcək. Davam etmək istəyirsiniz?')) {
            setElements([])
          }
        }}
        title="Canvas-ı sıfırla"
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 text-xs font-medium transition-all shrink-0"
      >
        Lovhəni təmizlə
      </button>

      {/* Sil */}
      {selectedIds.length > 0 && (
        <>
          <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
          {selectedIds.length > 1 && (
            <>
              <button onClick={groupSelected} title="Group et (Ctrl+G)"
                className="p-2 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-all shrink-0">
                <Group size={16} />
              </button>
              <button onClick={ungroupSelected} title="Ungroup et (Ctrl+Shift+G)"
                className="p-2 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-all shrink-0">
                <Ungroup size={16} />
              </button>
            </>
          )}
          <button onClick={deleteSelected} title="Sil (Delete)"
            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0">
            <Trash2 size={16} />
          </button>
        </>
      )}

      <div className="flex-1" />

      {/* PDF toggle */}
      <button
        onClick={onTogglePdf}
        title={pdfOpen ? 'PDF-i bağla' : 'PDF aç'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all shrink-0 ${
          pdfOpen
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        <BookOpen size={15} />
        PDF
      </button>

      {/* Export */}
      <button
        onClick={onExport}
        title="PDF kimi ixrac et"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all shrink-0"
      >
        <Download size={15} />
        İxrac
      </button>
    </div>
  )
}
