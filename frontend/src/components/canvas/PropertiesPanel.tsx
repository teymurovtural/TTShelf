import { useCanvasStore } from '../../store/canvasStore'
import type { ElementData } from '../../types'

const PRESET_FILLS = [
  'transparent',
  '#ffffff', '#f1f5f9', '#e2e8f0',
  '#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#f3e8ff',
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#1e40af', '#166534', '#92400e', '#991b1b', '#5b21b6',
  '#0f172a', '#1e293b', '#374151',
]

const PRESET_STROKES = [
  'transparent',
  '#0f172a', '#374151', '#64748b', '#94a3b8',
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
]

const STROKE_WIDTHS = [0, 1, 2, 3, 4, 6, 8]
const FONT_SIZES   = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 96]
const OPACITIES    = [0.1, 0.25, 0.5, 0.75, 1]

function ColorSwatch({
  color, selected, onClick,
}: { color: string; selected: boolean; onClick: () => void }) {
  const isTransparent = color === 'transparent'
  return (
    <button
      onClick={onClick}
      title={isTransparent ? 'Şəffaf' : color}
      className={`w-6 h-6 rounded-md border-2 transition-all hover:scale-110 ${
        selected ? 'border-indigo-500 scale-110' : 'border-gray-200'
      } ${isTransparent ? 'relative overflow-hidden' : ''}`}
      style={{ background: isTransparent ? undefined : color }}
    >
      {isTransparent && (
        <div className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%), linear-gradient(135deg, #e5e7eb 25%, #ffffff 25%, #ffffff 75%, #e5e7eb 75%)',
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 4px 4px',
          }}
        />
      )}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}

export default function PropertiesPanel() {
  const { elements, selectedId, updateElement } = useCanvasStore()
  const el = elements.find((e) => e.id === selectedId)

  if (!el) {
    return (
      <div className="w-56 border-l border-gray-200 bg-white flex items-center justify-center p-6 text-center shrink-0">
        <p className="text-xs text-gray-400 leading-relaxed">
          Element seçin<br />
          <span className="text-gray-300">xüsusiyyətləri burada görünəcək</span>
        </p>
      </div>
    )
  }

  const d = el.data
  const isShape  = ['rect', 'circle'].includes(el.type)
  const isLine   = ['line', 'arrow', 'freehand'].includes(el.type)
  const isText   = el.type === 'text'
  const isImage  = el.type === 'image'

  const update = (patch: Partial<ElementData>) => updateElement(el.id, patch)

  return (
    <div className="w-56 border-l border-gray-200 bg-white overflow-y-auto shrink-0">
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-700 capitalize">
          {el.type === 'rect' ? 'Düzbucaqlı'
            : el.type === 'circle' ? 'Dairə'
            : el.type === 'line' ? 'Xətt'
            : el.type === 'arrow' ? 'Ok'
            : el.type === 'freehand' ? 'Çizgi'
            : el.type === 'text' ? 'Mətn'
            : 'Şəkil'}
        </p>
      </div>

      <div className="p-3">
        {/* Doldurma rəngi — shape üçün */}
        {isShape && (
          <Section title="Doldurma">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_FILLS.map((c) => (
                <ColorSwatch
                  key={c} color={c}
                  selected={d.fill === c}
                  onClick={() => update({ fill: c })}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={d.fill === 'transparent' || !d.fill ? '#ffffff' : d.fill}
                onChange={(e) => update({ fill: e.target.value })}
                className="w-8 h-7 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                title="Xüsusi rəng"
              />
              <input
                type="text"
                value={d.fill || 'transparent'}
                onChange={(e) => update({ fill: e.target.value })}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 font-mono"
                placeholder="#hex"
              />
            </div>
          </Section>
        )}

        {/* Xətt rəngi — shape + line/arrow/freehand */}
        {(isShape || isLine) && (
          <Section title="Kontur rəngi">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {PRESET_STROKES.map((c) => (
                <ColorSwatch
                  key={c} color={c}
                  selected={d.stroke === c}
                  onClick={() => update({ stroke: c })}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={d.stroke === 'transparent' || !d.stroke ? '#000000' : d.stroke}
                onChange={(e) => update({ stroke: e.target.value })}
                className="w-8 h-7 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={d.stroke || '#000000'}
                onChange={(e) => update({ stroke: e.target.value })}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 font-mono"
                placeholder="#hex"
              />
            </div>
          </Section>
        )}

        {/* Xətt qalınlığı */}
        {(isShape || isLine) && (
          <Section title="Kontur qalınlığı">
            <div className="flex gap-1.5 flex-wrap">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => update({ strokeWidth: w })}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    (d.strokeWidth ?? 2) === w
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {w === 0 ? 'Yox' : `${w}px`}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Şəffaflıq */}
        {!isImage && (
          <Section title="Şəffaflıq">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0} max={1} step={0.05}
                value={d.opacity ?? 1}
                onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-xs text-gray-500 w-10 text-right">
                {Math.round((d.opacity ?? 1) * 100)}%
              </span>
            </div>
          </Section>
        )}

        {/* Mətn xüsusiyyətləri */}
        {isText && (
          <>
            <Section title="Mətn rəngi">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {PRESET_STROKES.map((c) => (
                  <ColorSwatch
                    key={c} color={c}
                    selected={d.fill === c}
                    onClick={() => update({ fill: c })}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={d.fill === 'transparent' || !d.fill ? '#000000' : d.fill}
                  onChange={(e) => update({ fill: e.target.value })}
                  className="w-8 h-7 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={d.fill || '#000000'}
                  onChange={(e) => update({ fill: e.target.value })}
                  className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 font-mono"
                />
              </div>
            </Section>

            <Section title="Font ölçüsü">
              <div className="flex flex-wrap gap-1.5">
                {FONT_SIZES.map((s) => (
                  <button
                    key={s}
                    onClick={() => update({ fontSize: s })}
                    className={`px-2 py-1 text-xs rounded-lg border transition-all ${
                      d.fontSize === s
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <input
                  type="number"
                  value={d.fontSize ?? 20}
                  onChange={(e) => update({ fontSize: parseInt(e.target.value) || 20 })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-400"
                  min={6} max={400}
                />
              </div>
            </Section>
          </>
        )}

        {/* Ölçülər — shape üçün */}
        {isShape && (
          <Section title="Ölçülər">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'X', key: 'x' },
                { label: 'Y', key: 'y' },
                { label: 'En', key: 'width' },
                { label: 'Hünd.', key: 'height' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <p className="text-[10px] text-gray-400 mb-1">{label}</p>
                  <input
                    type="number"
                    value={Math.round((d as any)[key] ?? 0)}
                    onChange={(e) => update({ [key]: parseFloat(e.target.value) || 0 })}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
                  />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Dairə radius — shape üçün */}
        {isShape && (
          <Section title="Dönmə">
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-180} max={180} step={1}
                value={d.rotation ?? 0}
                onChange={(e) => update({ rotation: parseFloat(e.target.value) })}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-xs text-gray-500 w-10 text-right">{Math.round(d.rotation ?? 0)}°</span>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
