import {
  MousePointer2, Hand, Square, Circle, ArrowRight,
  Type, Image, Minus, Pencil, Trash2, Undo2, Redo2,
  Download, BookOpen
} from 'lucide-react'
import { useCanvasStore } from '../../store/canvasStore'
import type { ElementType } from '../../types'

type Tool = ElementType | 'select' | 'pan'

interface ToolbarProps {
  onExport: () => void
  onTogglePdf: () => void
  pdfOpen: boolean
  isDirty: boolean
  canvasTitle: string
  onTitleChange: (title: string) => void
}

const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 size={18} />, label: 'Seç' },
  { id: 'pan', icon: <Hand size={18} />, label: 'Sürüşdür' },
  { id: 'rect', icon: <Square size={18} />, label: 'Düzbucaqlı' },
  { id: 'circle', icon: <Circle size={18} />, label: 'Dairə' },
  { id: 'line', icon: <Minus size={18} />, label: 'Xətt' },
  { id: 'arrow', icon: <ArrowRight size={18} />, label: 'Ok' },
  { id: 'text', icon: <Type size={18} />, label: 'Mətn' },
  { id: 'freehand', icon: <Pencil size={18} />, label: 'Çizgi' },
  { id: 'image', icon: <Image size={18} />, label: 'Şəkil' },
]

export default function Toolbar({
  onExport, onTogglePdf, pdfOpen, isDirty, canvasTitle, onTitleChange
}: ToolbarProps) {
  const { tool, setTool, selectedId, deleteElement, undo, redo } = useCanvasStore()

  return (
    <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center px-3 gap-2 shrink-0">
      {/* Canvas başlığı */}
      <input
        value={canvasTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        className="bg-transparent text-white text-sm font-medium outline-none border-b border-transparent focus:border-gray-600 px-1 w-36 truncate"
      />

      {/* Save indicator */}
      <span className={`text-xs mr-2 ${isDirty ? 'text-yellow-500' : 'text-gray-600'}`}>
        {isDirty ? '●' : '✓'}
      </span>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Alətlər */}
      <div className="flex items-center gap-1">
        {tools.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={`p-2 rounded-lg transition-colors ${
              tool === t.id
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Undo/Redo */}
      <button onClick={undo} title="Geri al (Ctrl+Z)"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
        <Undo2 size={18} />
      </button>
      <button onClick={redo} title="İrəli al (Ctrl+Y)"
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800">
        <Redo2 size={18} />
      </button>

      {/* Sil */}
      {selectedId && (
        <button
          onClick={() => deleteElement(selectedId)}
          title="Sil (Delete)"
          className="p-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-gray-800"
        >
          <Trash2 size={18} />
        </button>
      )}

      <div className="flex-1" />

      {/* PDF toggle */}
      <button
        onClick={onTogglePdf}
        title={pdfOpen ? 'PDF-i bağla' : 'PDF aç'}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          pdfOpen ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
        }`}
      >
        <BookOpen size={16} />
        PDF
      </button>

      {/* Export */}
      <button
        onClick={onExport}
        title="PDF kimi ixrac et"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-sm transition-colors"
      >
        <Download size={16} />
        İxrac
      </button>
    </div>
  )
}
