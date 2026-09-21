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
    '#ffffff', '#94a3b8', '#64748b',
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
    '#0f172a',
]

const STROKE_WIDTHS = [0, 1, 2, 3, 4, 6, 8]

const STROKE_STYLES = [
    { id: 'solid',  dash: undefined as number[] | undefined,
        svg: <svg width="36" height="6"><line x1="2" y1="3" x2="34" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
    { id: 'dashed', dash: [8, 4] as number[],
        svg: <svg width="36" height="6"><line x1="2" y1="3" x2="34" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="8,4"/></svg> },
    { id: 'dotted', dash: [2, 4] as number[],
        svg: <svg width="36" height="6"><line x1="2" y1="3" x2="34" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="2,4"/></svg> },
]

// ── Rəng yığcam görünüş ──
function Swatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
    const isT = color === 'transparent'
    return (
        <button
            onClick={onClick}
            title={isT ? 'Şəffaf' : color}
            style={{
                width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                border: selected ? '2px solid #6366f1' : '1.5px solid rgba(255,255,255,0.12)',
                background: isT ? undefined : color,
                cursor: 'pointer',
                position: 'relative', overflow: 'hidden',
                transform: selected ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.1s, border-color 0.1s',
                boxShadow: selected ? '0 0 0 2px rgba(99,102,241,0.4)' : 'none',
            }}
        >
            {isT && (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg,#444 25%,transparent 25%,transparent 75%,#444 75%),linear-gradient(135deg,#444 25%,#222 25%,#222 75%,#444 75%)',
                    backgroundSize: '8px 8px',
                    backgroundPosition: '0 0,4px 4px',
                }} />
            )}
        </button>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {title}
            </p>
            {children}
        </div>
    )
}

const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7,
    color: '#c8c8d8', fontSize: 11, padding: '5px 8px', outline: 'none',
    fontFamily: 'inherit',
}

const smallBtnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
    color: '#9090b0', transition: 'all 0.12s', fontSize: 11,
}

const TYPE_LABEL: Record<string, string> = {
    rect: 'Düzbucaqlı', circle: 'Dairə', triangle: 'Üçbucaq',
    diamond: 'Romb', pentagon: 'Beşbucaq', hexagon: 'Altıbucaq',
    star: 'Ulduz', parallelogram: 'Paraleloqram', cross: 'Xaç',
    cylinder: 'Silindr', line: 'Xətt', arrow: 'Ok',
    freehand: 'Çizgi', text: 'Mətn', image: 'Şəkil',
}

export default function PropertiesPanel() {
    const { elements, selectedIds, updateElement } = useCanvasStore()
    const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
    const el = elements.find((e) => e.id === selectedId)

    if (!el) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
            <p style={{ fontSize: 11, color: '#3a3a5a', textAlign: 'center', lineHeight: 1.6 }}>
                Element seçin<br />
                <span style={{ color: '#2a2a4a' }}>xüsusiyyətlər burada görünəcək</span>
            </p>
        </div>
    )

    const d = el.data
    const isShape = ['rect','circle','triangle','diamond','pentagon','hexagon','star','parallelogram','cross','cylinder'].includes(el.type)
    const isLine  = ['line','arrow','freehand'].includes(el.type)
    const isText  = el.type === 'text'
    const isImage = el.type === 'image'

    const update = (patch: Partial<ElementData>) => updateElement(el.id, patch)

    const updateTextAll = (patch: Partial<ElementData>, runKeys: (keyof TextRun)[]) => {
        const runs = d.runs as TextRun[] | undefined
        const cleaned = runs?.map((r) => {
            const c: TextRun = { ...r }
            runKeys.forEach((k) => { delete (c as any)[k] })
            return c
        })
        updateElement(el.id, { ...patch, ...(cleaned ? { runs: cleaned } : {}) })
    }

    const currentDash = d.dash
    const currentStyleId = !currentDash || currentDash.length === 0
        ? 'solid' : currentDash[0] <= 2 ? 'dotted' : 'dashed'

    return (
        <div style={{ overflowY: 'auto' }}>
            {/* Başlıq */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#818cf8' }}>
                    {TYPE_LABEL[el.type] ?? el.type}
                </p>
            </div>

            <div style={{ padding: '12px 12px' }}>

                {/* Doldurma */}
                {isShape && (
                    <Section title="Doldurma">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                            {PRESET_FILLS.map((c) => (
                                <Swatch key={c} color={c} selected={d.fill === c} onClick={() => update({ fill: c })} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="color"
                                   value={d.fill === 'transparent' || !d.fill ? '#ffffff' : d.fill}
                                   onChange={(e) => update({ fill: e.target.value })}
                                   style={{ width: 28, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 2, background: 'transparent' }}
                            />
                            <input type="text"
                                   value={d.fill || 'transparent'}
                                   onChange={(e) => update({ fill: e.target.value })}
                                   style={{ ...inputStyle, fontFamily: 'monospace' }}
                                   placeholder="#hex"
                            />
                        </div>
                    </Section>
                )}

                {/* Kontur rəngi */}
                {(isShape || isLine) && (
                    <Section title="Kontur rəngi">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                            {PRESET_STROKES.map((c) => (
                                <Swatch key={c} color={c} selected={d.stroke === c} onClick={() => update({ stroke: c })} />
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input type="color"
                                   value={d.stroke === 'transparent' || !d.stroke ? '#000000' : d.stroke}
                                   onChange={(e) => update({ stroke: e.target.value })}
                                   style={{ width: 28, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 2, background: 'transparent' }}
                            />
                            <input type="text"
                                   value={d.stroke || '#000000'}
                                   onChange={(e) => update({ stroke: e.target.value })}
                                   style={{ ...inputStyle, fontFamily: 'monospace' }}
                                   placeholder="#hex"
                            />
                        </div>
                    </Section>
                )}

                {/* Xətt tipi */}
                {(isShape || isLine) && (
                    <Section title="Xətt tipi">
                        <div style={{ display: 'flex', gap: 6 }}>
                            {STROKE_STYLES.map((s) => (
                                <button
                                    key={s.id}
                                    onClick={() => update({ dash: s.dash })}
                                    title={s.id}
                                    style={{
                                        ...smallBtnBase,
                                        flex: 1, padding: '6px 0',
                                        background: currentStyleId === s.id ? 'rgba(79,70,229,0.25)' : 'rgba(255,255,255,0.04)',
                                        border: currentStyleId === s.id ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                                        color: currentStyleId === s.id ? '#818cf8' : '#5a5a7a',
                                    }}
                                >
                                    {s.svg}
                                </button>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Dash sıxlığı — yalnız däsh/dotted seçiləndə */}
                {(isShape || isLine) && currentStyleId !== 'solid' && (() => {
                    const dash = d.dash || [8, 4]
                    const density = dash[0]
                    return (
                        <Section title="ؚətt sıxlığı">
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 10, color: "#7070a0" }}>Az</span>
                                <input type="range" min={1} max={20} step={1}
                                       value={density}
                                       onChange={e => {
                                           const v = Number(e.target.value)
                                           const gap = currentStyleId === 'dotted' ? Math.max(2, v * 2) : Math.max(2, v)
                                           update({ dash: [v, gap] })
                                       }}
                                       style={{ flex: 1, accentColor: "#6366f1" }}
                                />
                                <span style={{ fontSize: 10, color: "#7070a0" }}>Cox</span>
                            </div>
                        </Section>
                    )
                })()}

                {/* Kontur qalınlığı */}
                {(isShape || isLine) && (
                    <Section title="Kontur qalınlığı">
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {STROKE_WIDTHS.map((w) => (
                                <button
                                    key={w}
                                    onClick={() => update({ strokeWidth: w })}
                                    style={{
                                        ...smallBtnBase,
                                        padding: '4px 8px', fontSize: 10,
                                        background: (d.strokeWidth ?? 2) === w ? 'rgba(79,70,229,0.25)' : 'rgba(255,255,255,0.04)',
                                        border: (d.strokeWidth ?? 2) === w ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                                        color: (d.strokeWidth ?? 2) === w ? '#818cf8' : '#7070a0',
                                    }}
                                >
                                    {w === 0 ? 'Yox' : `${w}px`}
                                </button>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Xətt / Boşluq slider */}
                {isLine && (() => {
                    const dashVal = d.dash ? d.dash[0] : 0
                    const gapVal  = d.dash ? d.dash[1] : 0
                    return (
                        <Section title="Xətt / Boşluq">
                            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <span style={{ fontSize:10, color:"#7070a0", minWidth:36 }}>Xətt</span>
                                    <input type="range" min={0} max={40} step={1} value={dashVal}
                                           onChange={e => { const v=Number(e.target.value); update({ dash: v===0 ? undefined : [v, gapVal||v] } as any) }}
                                           style={{ flex:1, accentColor:"#6366f1" }} />
                                    <span style={{ fontSize:10, color:"#7070a0", minWidth:20, textAlign:"right" }}>{dashVal}</span>
                                </div>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                    <span style={{ fontSize:10, color:"#7070a0", minWidth:36 }}>Boşluq</span>
                                    <input type="range" min={0} max={40} step={1} value={gapVal}
                                           onChange={e => { const v=Number(e.target.value); update({ dash: dashVal===0 ? undefined : [dashVal, v] } as any) }}
                                           style={{ flex:1, accentColor:"#6366f1" }} />
                                    <span style={{ fontSize:10, color:"#7070a0", minWidth:20, textAlign:"right" }}>{gapVal}</span>
                                </div>
                            </div>
                        </Section>
                    )
                })()}

                {/* Şəffaflıq */}
                {!isImage && (
                    <Section title="Şəffaflıq">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="range" min={0} max={1} step={0.05}
                                   value={d.opacity ?? 1}
                                   onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
                                   style={{ flex: 1, accentColor: '#6366f1' }}
                            />
                            <span style={{ fontSize: 11, color: '#7070a0', width: 32, textAlign: 'right' }}>
                {Math.round((d.opacity ?? 1) * 100)}%
              </span>
                        </div>
                    </Section>
                )}

                {/* Mətn xüsusiyyətləri */}
                {isText && (() => {
                    const fontFamily  = d.fontFamily  ?? 'Arial'
                    const fontSize    = d.fontSize    ?? 20
                    const fill        = d.fill        ?? '#ffffff'
                    const bold        = (d as any).fontStyle?.includes('bold')   ?? false
                    const italic      = (d as any).fontStyle?.includes('italic') ?? false
                    const underline   = (d as any).textDecoration === 'underline'
                    const align       = (d as any).align ?? 'left'
                    const letterSpace = (d as any).letterSpacing ?? 0
                    const lineH       = (d as any).lineHeight ?? 1.2

                    const toggleBold = () => {
                        const cur = (d as any).fontStyle ?? 'normal'
                        const next = bold ? cur.replace('bold','').trim() || 'normal' : cur === 'normal' ? 'bold' : cur + ' bold'
                        updateTextAll({ fontStyle: next } as any, ['fontStyle'])
                    }
                    const toggleItalic = () => {
                        const cur = (d as any).fontStyle ?? 'normal'
                        const next = italic ? cur.replace('italic','').trim() || 'normal' : cur === 'normal' ? 'italic' : cur + ' italic'
                        updateTextAll({ fontStyle: next } as any, ['fontStyle'])
                    }

                    const FONTS = ['Arial','Arial Black','Comic Sans MS','Courier New','Georgia','Impact','Times New Roman','Trebuchet MS','Verdana','Helvetica','Tahoma']

                    return (
                        <>
                            <Section title="Font">
                                <select
                                    value={fontFamily}
                                    onChange={(e) => updateTextAll({ fontFamily: e.target.value }, ['fontFamily'])}
                                    style={{ ...inputStyle, fontFamily, appearance: 'none', cursor: 'pointer' }}
                                >
                                    {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f, background: '#1e1e2e', color: '#c8c8d8' }}>{f}</option>)}
                                </select>
                            </Section>

                            <Section title="Stil">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                    <input type="number" value={fontSize} min={6} max={400}
                                           onChange={(e) => updateTextAll({ fontSize: parseInt(e.target.value) || 20 }, ['fontSize'])}
                                           style={{ ...inputStyle, width: 56, textAlign: 'center' }}
                                    />
                                    <span style={{ fontSize: 10, color: '#4a4a6a' }}>px</span>
                                    <div style={{ flex: 1 }} />
                                    {[
                                        { lbl: 'B', active: bold,     onClick: toggleBold,    extra: { fontWeight: 700 } },
                                        { lbl: 'I', active: italic,    onClick: toggleItalic,  extra: { fontStyle: 'italic' } },
                                        { lbl: 'U', active: underline, onClick: () => updateTextAll({ textDecoration: underline ? 'none' : 'underline' } as any, ['textDecoration']), extra: { textDecoration: 'underline' } },
                                    ].map(({ lbl, active, onClick, extra }) => (
                                        <button key={lbl} onClick={onClick}
                                                style={{
                                                    ...smallBtnBase, width: 28, height: 28,
                                                    background: active ? 'rgba(79,70,229,0.35)' : 'rgba(255,255,255,0.06)',
                                                    border: active ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                                                    color: active ? '#a5b4fc' : '#7070a0',
                                                    ...extra,
                                                }}
                                        >{lbl}</button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                                    {[10,12,14,16,18,20,24,28,32,36,48,64].map((s) => (
                                        <button key={s} onClick={() => updateTextAll({ fontSize: s }, ['fontSize'])}
                                                style={{
                                                    ...smallBtnBase, padding: '2px 5px', fontSize: 10,
                                                    background: fontSize === s ? 'rgba(79,70,229,0.25)' : 'rgba(255,255,255,0.04)',
                                                    border: fontSize === s ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.08)',
                                                    color: fontSize === s ? '#818cf8' : '#5a5a7a',
                                                }}
                                        >{s}</button>
                                    ))}
                                </div>
                            </Section>

                            <Section title="Hizalama">
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {(['left','center','right'] as const).map((v) => (
                                        <button key={v} onClick={() => update({ align: v } as any)}
                                                style={{
                                                    ...smallBtnBase, flex: 1, padding: '6px 0',
                                                    background: align === v ? 'rgba(79,70,229,0.25)' : 'rgba(255,255,255,0.04)',
                                                    border: align === v ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)',
                                                    color: align === v ? '#818cf8' : '#5a5a7a',
                                                }}
                                        >
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: v === 'left' ? 'flex-start' : v === 'center' ? 'center' : 'flex-end', padding: '0 6px' }}>
                        <span style={{ display: 'block', height: 1.5, width: '100%', background: 'currentColor', borderRadius: 1 }} />
                        <span style={{ display: 'block', height: 1.5, width: '65%',  background: 'currentColor', borderRadius: 1 }} />
                        <span style={{ display: 'block', height: 1.5, width: '100%', background: 'currentColor', borderRadius: 1 }} />
                      </span>
                                        </button>
                                    ))}
                                </div>
                            </Section>

                            <Section title="Aralıqlar">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div>
                                        <p style={{ fontSize: 10, color: '#4a4a6a', marginBottom: 4 }}>Hərf</p>
                                        <input type="number" value={letterSpace} min={-20} max={200} step={0.5}
                                               onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) || 0 } as any)}
                                               style={{ ...inputStyle, textAlign: 'center' }}
                                        />
                                        <input type="range" min={-20} max={200} step={0.5} value={letterSpace}
                                               onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) } as any)}
                                               style={{ width: '100%', marginTop: 4, accentColor: '#6366f1' }}
                                        />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 10, color: '#4a4a6a', marginBottom: 4 }}>Sətir</p>
                                        <input type="number" value={lineH} min={0.5} max={5} step={0.05}
                                               onChange={(e) => update({ lineHeight: parseFloat(e.target.value) || 1.2 } as any)}
                                               style={{ ...inputStyle, textAlign: 'center' }}
                                        />
                                        <input type="range" min={0.5} max={5} step={0.05} value={lineH}
                                               onChange={(e) => update({ lineHeight: parseFloat(e.target.value) } as any)}
                                               style={{ width: '100%', marginTop: 4, accentColor: '#6366f1' }}
                                        />
                                    </div>
                                </div>
                            </Section>

                            <Section title="Mətn rəngi">
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                                    {PRESET_STROKES.map((c) => (
                                        <Swatch key={c} color={c} selected={fill === c} onClick={() => updateTextAll({ fill: c }, ['fill'])} />
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <input type="color"
                                           value={fill === 'transparent' || !fill ? '#000000' : fill}
                                           onChange={(e) => updateTextAll({ fill: e.target.value }, ['fill'])}
                                           style={{ width: 28, height: 26, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', padding: 2, background: 'transparent' }}
                                    />
                                    <input type="text" value={fill || '#ffffff'}
                                           onChange={(e) => updateTextAll({ fill: e.target.value }, ['fill'])}
                                           style={{ ...inputStyle, fontFamily: 'monospace' }}
                                    />
                                </div>
                            </Section>

                            <Section title="Mətn qutusu">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                    {[
                                        { label: 'X', key: 'x' }, { label: 'Y', key: 'y' },
                                        ...((d as any).autoWidth === false
                                            ? [{ label: 'En', key: 'width' }, { label: 'Hünd.', key: 'height' }] : []),
                                    ].map(({ label, key }) => (
                                        <div key={key}>
                                            <p style={{ fontSize: 10, color: '#4a4a6a', marginBottom: 4 }}>{label}</p>
                                            <input type="number"
                                                   value={Math.round((d as any)[key] ?? 0)}
                                                   onChange={(e) => update({ [key]: parseFloat(e.target.value) || 0 })}
                                                   style={inputStyle}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
                                    <p style={{ fontSize: 10, color: '#4a4a6a' }}>Dönmə</p>
                                    <button onClick={() => update({ rotation: 0 })}
                                            style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>Sıfırla</button>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input type="range" min={-180} max={180} step={1}
                                           value={d.rotation ?? 0}
                                           onChange={(e) => update({ rotation: parseFloat(e.target.value) })}
                                           style={{ flex: 1, accentColor: '#6366f1' }}
                                    />
                                    <span style={{ fontSize: 11, color: '#7070a0', width: 32, textAlign: 'right' }}>{Math.round(d.rotation ?? 0)}°</span>
                                </div>
                            </Section>
                        </>
                    )
                })()}

                {/* Shape ölçüləri */}
                {isShape && (
                    <Section title="Ölçülər">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {[
                                { label: 'X', key: 'x' }, { label: 'Y', key: 'y' },
                                { label: 'En', key: 'width' }, { label: 'Hünd.', key: 'height' },
                            ].map(({ label, key }) => (
                                <div key={key}>
                                    <p style={{ fontSize: 10, color: '#4a4a6a', marginBottom: 4 }}>{label}</p>
                                    <input type="number"
                                           value={Math.round((d as any)[key] ?? 0)}
                                           onChange={(e) => update({ [key]: parseFloat(e.target.value) || 0 })}
                                           style={inputStyle}
                                    />
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Shape dönmə */}
                {isShape && (
                    <Section title="Dönmə">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
                            <button onClick={() => update({ rotation: 0 })}
                                    style={{ fontSize: 10, color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer' }}>Sıfırla</button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="range" min={-180} max={180} step={1}
                                   value={d.rotation ?? 0}
                                   onChange={(e) => update({ rotation: parseFloat(e.target.value) })}
                                   style={{ flex: 1, accentColor: '#6366f1' }}
                            />
                            <span style={{ fontSize: 11, color: '#7070a0', width: 32, textAlign: 'right' }}>{Math.round(d.rotation ?? 0)}°</span>
                        </div>
                    </Section>
                )}

                {/* Künc radiusu */}
                {isShape && (
                    <Section title="Künc radiusu">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <input type="range" min={0} max={200} step={1}
                                   value={Array.isArray(d.cornerRadius) ? (d.cornerRadius[0] ?? 0) : (d.cornerRadius ?? 0)}
                                   onChange={(e) => update({ cornerRadius: parseFloat(e.target.value) } as any)}
                                   style={{ flex: 1, accentColor: '#6366f1' }}
                            />
                            <span style={{ fontSize: 11, color: '#7070a0', width: 36, textAlign: 'right' }}>
                {Array.isArray(d.cornerRadius) ? (d.cornerRadius[0] ?? 0) : (d.cornerRadius ?? 0)}px
              </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                            {['Sol üst','Sağ üst','Sağ alt','Sol alt'].map((label, i) => {
                                const cr = Array.isArray(d.cornerRadius)
                                    ? d.cornerRadius
                                    : [d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0]
                                return (
                                    <div key={i}>
                                        <p style={{ fontSize: 10, color: '#4a4a6a', marginBottom: 3 }}>{label}</p>
                                        <input type="number" min={0} max={500}
                                               value={cr[i] ?? 0}
                                               onChange={(e) => {
                                                   const newCr = [...(Array.isArray(d.cornerRadius)
                                                       ? d.cornerRadius
                                                       : [d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0,d.cornerRadius??0])]
                                                   newCr[i] = parseFloat(e.target.value) || 0
                                                   update({ cornerRadius: newCr } as any)
                                               }}
                                               style={{ ...inputStyle, textAlign: 'center' }}
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