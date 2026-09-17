import { useState } from 'react'
import { Layers, SlidersHorizontal, X } from 'lucide-react'
import LayersPanel from './LayersPanel'
import PropertiesPanel from './PropertiesPanel'
import { useCanvasStore } from '../../store/canvasStore'

export default function LeftPanel() {
  const [open, setOpen] = useState<'layers' | 'properties' | null>(null)
  const { selectedIds } = useCanvasStore()

  const toggle = (tab: 'layers' | 'properties') => {
    setOpen((prev) => (prev === tab ? null : tab))
  }

  return (
    <>
      {/* İkon sütunu — canvas üzərindən üzür, sol yapışıq */}
      <div className="absolute left-0 top-2 flex flex-col gap-1 p-1 bg-white border border-gray-200 rounded-r-xl shadow-md z-30">
        <button
          onClick={() => toggle('layers')}
          title="Layerlər"
          className={`p-2 rounded-lg transition-all ${
            open === 'layers'
              ? 'bg-indigo-600 text-white'
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Layers size={17} />
        </button>
        <button
          onClick={() => toggle('properties')}
          title="Xüsusiyyətlər"
          className={`p-2 rounded-lg transition-all ${
            open === 'properties'
              ? 'bg-indigo-600 text-white'
              : selectedIds.length > 0
                ? 'text-indigo-500 hover:bg-gray-100'
                : 'text-gray-400 hover:bg-gray-100'
          }`}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>

      {/* Açıq panel — canvas üzərindən üzür */}
      {open !== null && (
        <div
          className="absolute left-10 top-2 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden flex flex-col"
          style={{ width: 220, maxHeight: 'calc(100vh - 60px)' }}
        >
          {/* Panel başlığı */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
            <span className="text-xs font-semibold text-gray-600">
              {open === 'layers' ? 'Layerlər' : 'Xüsusiyyətlər'}
            </span>
            <button
              onClick={() => setOpen(null)}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              <X size={14} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {open === 'layers'     && <LayersPanel />}
            {open === 'properties' && <PropertiesPanel />}
          </div>
        </div>
      )}
    </>
  )
}
