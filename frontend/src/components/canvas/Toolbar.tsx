import {
  MousePointer2, Hand, Square, Circle, ArrowRight,
  Type, ImageIcon, Minus, Pencil, Trash2, Undo2, Redo2,
  Download, BookOpen, ChevronDown
} from 'lucide-react'
import { useRef, useState } from 'react'
import { useCanvasStore } from '../../store/canvasStore'
import type { ElementType } from '../../types'

type Tool = ElementType | 'select' | 'pan'

const TOOLS: { id: Tool; icon: React.ReactNode; label: string; shortcut?: string }[] = [
  { id: 'select',   icon: <MousePointer2 size={16} />, label: 'Seç',        shortcut: 'V' },
  { id: 'pan',      icon: <Hand size={16} />,          label: 'Sürüşdür',   shortcut: 'H' },
  { id: 'rect',     icon: <Square size={16} />,        label: 'Düzbucaqlı', shortcut: 'R' },
  { id: 'circle',   icon: <Circle size={16} />,        label: 'Dairə',      shortcut: 'C' },
  { id: 'line',     icon: <Minus size={16} />,         label: 'Xətt',       shortcut: 'L' },
  { id: 'arrow',    icon: <ArrowRight size={16} />,    label: 'Ok',         shortcut: 'A' },
  { id: 'text',     icon: <Type size={16} />,          label: 'Mətn',       shortcut: 'T' },
  { id: 'freehand', icon: <Pencil size={16} />,        label: 'Çizgi',      shortcut: 'P' },
  { id: 'image',    icon: <ImageIcon size={16} />,     label: 'Şəkil',      shortcut: 'I' },
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
  const { tool, setTool, selectedId, deleteElement, undo, redo } = useCanvasStore()
  const [strokeOpen, setStrokeOpen] = useState(false)
  const strokeRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
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

      {/* Alətlər */}
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
      </div>

      <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />

      {/* Undo / Redo */}
      <button onClick={undo} title="Geri al (Ctrl+Z)"
        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all shrink-0">
        <Undo2 size={16} />
      </button>
      <button onClick={redo} title="İrəli al (Ctrl+Y)"
        className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-all shrink-0">
        <Redo2 size={16} />
      </button>

      {/* Sil */}
      {selectedId && (
        <>
          <div className="w-px h-5 bg-gray-200 mx-0.5 shrink-0" />
          <button
            onClick={() => deleteElement(selectedId)}
            title="Sil (Delete)"
            className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
          >
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
