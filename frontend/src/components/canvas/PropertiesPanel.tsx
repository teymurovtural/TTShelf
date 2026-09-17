import { useCanvasStore } from '../../store/canvasStore'
import type { ElementData, TextRun } from '../../types'

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
  const { elements, selectedIds, updateElement } = useCanvasStore()
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const el = elements.find((e) => e.id === selectedId)

  if (!el) return null

  if (false) {
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
  const isShape  = ['rect', 'circle', 'triangle', 'diamond', 'pentagon', 'hexagon', 'star', 'parallelogram', 'cross', 'cylinder'].includes(el.type)
  const isLine   = ['line', 'arrow', 'freehand'].includes(el.type)
  const isText   = el.type === 'text'
  const isImage  = el.type === 'image'

  const update = (patch: Partial<ElementData>) => updateElement(el.id, patch)

  // Mətn üçün: dəyişiklik BÜTÜN mətnə tətbiq olunur.
  // Bunun üçün run-lardakı fərdi override-ları silirik ki element səviyyəsindəki dəyər işləsin.
  // (Bir hissəni ayrıca dəyişmək üçün mətnə iki dəfə klikləyib üzən paneldən istifadə edin.)
  const updateTextAll = (patch: Partial<ElementData>, runKeys: (keyof TextRun)[]) => {
    const runs = d.runs as TextRun[] | undefined
    const cleaned = runs?.map((r) => {
      const c: TextRun = { ...r }
      runKeys.forEach((k) => { delete (c as any)[k] })
      return c
    })
    updateElement(el.id, { ...patch, ...(cleaned ? { runs: cleaned } : {}) })
  }

  return (
    <div className="w-56 border-r border-gray-200 bg-white overflow-y-auto shrink-0" style={{order: -1}}>
      <div className="p-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-700 capitalize">
          {el.type === 'rect' ? 'Düzbucaqlı'
            : el.type === 'circle' ? 'Dairə'
            : el.type === 'triangle' ? 'Üçbucaq'
            : el.type === 'diamond' ? 'Romb'
            : el.type === 'pentagon' ? 'Beşbucaq'
            : el.type === 'hexagon' ? 'Altıbucaq'
            : el.type === 'star' ? 'Ulduz'
            : el.type === 'parallelogram' ? 'Paraleloqram'
            : el.type === 'cross' ? 'Xaç'
            : el.type === 'cylinder' ? 'Silindr'
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

        {/* ── MƏTNİN XÜSUSİYYƏTLƏRİ (Illustrator kimi) ── */}
        {isText && (() => {
          const fontFamily  = d.fontFamily  ?? 'Arial'
          const fontSize    = d.fontSize    ?? 20
          const fill        = d.fill        ?? '#0f172a'
          const bold        = (d as any).fontStyle?.includes('bold')   ?? false
          const italic      = (d as any).fontStyle?.includes('italic') ?? false
          const underline   = (d as any).textDecoration === 'underline'
          const align       = (d as any).align ?? 'left'
          const letterSpace = (d as any).letterSpacing ?? 0
          const lineH       = (d as any).lineHeight ?? 1.2

          const toggleBold = () => {
            const cur = (d as any).fontStyle ?? 'normal'
            const next = bold
              ? cur.replace('bold', '').trim() || 'normal'
              : (cur === 'normal' ? 'bold' : cur + ' bold')
            updateTextAll({ fontStyle: next } as any, ['fontStyle'])
          }
          const toggleItalic = () => {
            const cur = (d as any).fontStyle ?? 'normal'
            const next = italic
              ? cur.replace('italic', '').trim() || 'normal'
              : (cur === 'normal' ? 'italic' : cur + ' italic')
            updateTextAll({ fontStyle: next } as any, ['fontStyle'])
          }

          const FONTS = [
            'Arial','Arial Black','Comic Sans MS','Courier New',
            'Georgia','Impact','Times New Roman','Trebuchet MS',
            'Verdana','Helvetica','Tahoma',
          ]

          return (
            <>
              {/* Font ailəsi */}
              <Section title="Font">
                <select
                  value={fontFamily}
                  onChange={(e) => updateTextAll({ fontFamily: e.target.value }, ['fontFamily'])}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 bg-white"
                  style={{ fontFamily }}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                  ))}
                </select>
              </Section>

              {/* Ölçü + B / I / U */}
              <Section title="Stil">
                <div className="flex items-center gap-1.5">
                  {/* Font ölçüsü */}
                  <input
                    type="number"
                    value={fontSize}
                    min={6} max={400}
                    onChange={(e) => updateTextAll({ fontSize: parseInt(e.target.value) || 20 }, ['fontSize'])}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 text-center"
                  />
                  <span className="text-xs text-gray-400">px</span>
                  <div className="flex-1" />
                  {/* Bold */}
                  <button
                    onClick={toggleBold}
                    title="Qalın (Ctrl+B)"
                    className={`w-7 h-7 rounded-lg text-sm font-bold border transition-all ${
                      bold ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >B</button>
                  {/* Italic */}
                  <button
                    onClick={toggleItalic}
                    title="Kursiv (Ctrl+I)"
                    className={`w-7 h-7 rounded-lg text-sm italic border transition-all ${
                      italic ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >I</button>
                  {/* Underline */}
                  <button
                    onClick={() => updateTextAll({ textDecoration: underline ? 'none' : 'underline' } as any, ['textDecoration'])}
                    title="Altından xətt (Ctrl+U)"
                    className={`w-7 h-7 rounded-lg text-sm underline border transition-all ${
                      underline ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >U</button>
                </div>

                {/* Font ölçüsü preset-ləri */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {[10,12,14,16,18,20,24,28,32,36,48,64].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateTextAll({ fontSize: s }, ['fontSize'])}
                      className={`px-1.5 py-0.5 text-[10px] rounded border transition-all ${
                        fontSize === s
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    >{s}</button>
                  ))}
                </div>
              </Section>

              {/* Hizalama */}
              <Section title="Hizalama">
                <div className="flex gap-1">
                  {([
                    { v: 'left',   label: '⬛▪▪', title: 'Sola' },
                    { v: 'center', label: '▪⬛▪', title: 'Ortaya' },
                    { v: 'right',  label: '▪▪⬛', title: 'Sağa' },
                  ] as const).map(({ v, label, title }) => (
                    <button
                      key={v}
                      onClick={() => update({ align: v } as any)}
                      title={title}
                      className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                        align === v
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {v === 'left' ? (
                        <span className="flex flex-col gap-0.5 items-start px-2">
                          <span className="block h-0.5 w-full bg-current rounded" />
                          <span className="block h-0.5 w-2/3 bg-current rounded" />
                          <span className="block h-0.5 w-full bg-current rounded" />
                        </span>
                      ) : v === 'center' ? (
                        <span className="flex flex-col gap-0.5 items-center px-2">
                          <span className="block h-0.5 w-full bg-current rounded" />
                          <span className="block h-0.5 w-2/3 bg-current rounded" />
                          <span className="block h-0.5 w-full bg-current rounded" />
                        </span>
                      ) : (
                        <span className="flex flex-col gap-0.5 items-end px-2">
                          <span className="block h-0.5 w-full bg-current rounded" />
                          <span className="block h-0.5 w-2/3 bg-current rounded" />
                          <span className="block h-0.5 w-full bg-current rounded" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </Section>

              {/* Hərf aralığı + Sətir aralığı */}
              <Section title="Aralıqlar">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Hərf aralığı</p>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={letterSpace}
                        min={-20} max={200} step={0.5}
                        onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) || 0 } as any)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 text-center"
                      />
                    </div>
                    <input
                      type="range" min={-20} max={200} step={0.5}
                      value={letterSpace}
                      onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) } as any)}
                      className="w-full mt-1 accent-indigo-600"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Sətir aralığı</p>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={lineH}
                        min={0.5} max={5} step={0.05}
                        onChange={(e) => update({ lineHeight: parseFloat(e.target.value) || 1.2 } as any)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 text-center"
                      />
                    </div>
                    <input
                      type="range" min={0.5} max={5} step={0.05}
                      value={lineH}
                      onChange={(e) => update({ lineHeight: parseFloat(e.target.value) } as any)}
                      className="w-full mt-1 accent-indigo-600"
                    />
                  </div>
                </div>
              </Section>

              {/* Mətn rəngi */}
              <Section title="Mətn rəngi">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_STROKES.map((c) => (
                    <ColorSwatch key={c} color={c} selected={fill === c} onClick={() => updateTextAll({ fill: c }, ['fill'])} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fill === 'transparent' || !fill ? '#000000' : fill}
                    onChange={(e) => updateTextAll({ fill: e.target.value }, ['fill'])}
                    className="w-8 h-7 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={fill || '#000000'}
                    onChange={(e) => updateTextAll({ fill: e.target.value }, ['fill'])}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400 font-mono"
                  />
                </div>
              </Section>

              {/* Mətn qutusu */}
              <Section title="Mətn qutusu">
                <div className="flex gap-1 mb-2">
                  <button
                    onClick={() => update({ autoWidth: true, width: 0, height: 0 } as any)}
                    className={`flex-1 py-1.5 text-[11px] rounded-lg border transition-all ${
                      (d as any).autoWidth !== false
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >Avtomatik en</button>
                  <button
                    onClick={() => update({
                      autoWidth: false,
                      width: Math.max(Math.abs(d.width ?? 0), 240),
                      height: Math.max(Math.abs(d.height ?? 0), 120),
                    } as any)}
                    className={`flex-1 py-1.5 text-[11px] rounded-lg border transition-all ${
                      (d as any).autoWidth === false
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >Sabit qutu</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'X', key: 'x' },
                    { label: 'Y', key: 'y' },
                    ...((d as any).autoWidth === false
                      ? [{ label: 'En', key: 'width' }, { label: 'Hünd.', key: 'height' }]
                      : []),
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

                <p className="text-[10px] text-gray-400 mt-2">Dönmə</p>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={-180} max={180} step={1}
                    value={d.rotation ?? 0}
                    onChange={(e) => update({ rotation: parseFloat(e.target.value) })}
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="text-xs text-gray-500 w-10 text-right">{Math.round(d.rotation ?? 0)}°</span>
                </div>

                <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                  Mətnin yalnız bir hissəsini dəyişmək üçün mətnə iki dəfə klikləyin,
                  hissəni seçin və üstdə açılan paneldən rəng/şrift/ölçü seçin.
                </p>
              </Section>
            </>
          )
        })()}

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

        {/* Dönmə */}
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

        {/* Künc yumrulaşdırma — bütün shape-lər üçün */}
        {isShape && (
          <Section title="Künc radiusu">
            <div className="flex items-center gap-2 mb-2">
              <input
                type="range"
                min={0} max={200} step={1}
                value={Array.isArray(d.cornerRadius) ? (d.cornerRadius[0] ?? 0) : (d.cornerRadius ?? 0)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  update({ cornerRadius: v } as any)
                }}
                className="flex-1 accent-indigo-600"
              />
              <span className="text-xs text-gray-500 w-10 text-right">
                {Array.isArray(d.cornerRadius) ? (d.cornerRadius[0] ?? 0) : (d.cornerRadius ?? 0)}px
              </span>
            </div>
            {/* Hər künc ayrıca */}
            <div className="grid grid-cols-2 gap-1.5">
              {['Sol üst', 'Sağ üst', 'Sağ alt', 'Sol alt'].map((label, i) => {
                const cr = Array.isArray(d.cornerRadius)
                  ? d.cornerRadius
                  : [d.cornerRadius ?? 0, d.cornerRadius ?? 0, d.cornerRadius ?? 0, d.cornerRadius ?? 0]
                return (
                  <div key={i}>
                    <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                    <input
                      type="number"
                      min={0} max={500}
                      value={cr[i] ?? 0}
                      onChange={(e) => {
                        const newCr = [...(Array.isArray(d.cornerRadius)
                          ? d.cornerRadius
                          : [d.cornerRadius ?? 0, d.cornerRadius ?? 0, d.cornerRadius ?? 0, d.cornerRadius ?? 0])]
                        newCr[i] = parseFloat(e.target.value) || 0
                        update({ cornerRadius: newCr } as any)
                      }}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-400"
                    />
                  </div>
                )
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
