import { useEffect, useRef, useState, useCallback } from 'react'
import type { CanvasElement } from '../../types'
import {
  getDefaults, getRuns, runsToHtml, domToRuns, applyStyleToRuns,
  getSelectionOffsets, setSelectionOffsets, runsToPlainText, styleAtRange,
  type TextRun,
} from './richText'

const FONTS = [
  'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
  'Impact', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Helvetica', 'Tahoma',
]
const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 96, 128]
const COLORS = [
  '#0f172a', '#374151', '#64748b', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#22c55e',
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
]

interface Props {
  el: CanvasElement
  /** ekran koordinatları (fixed) */
  left: number
  top: number
  scale: number
  /** area mətn üçün ekran ölçüləri, nöqtə mətni üçün undefined */
  areaW?: number
  areaH?: number
  onChange: (runs: TextRun[]) => void
  onFinish: () => void
}

export default function RichTextEditor({
  el, left, top, scale, areaW, areaH, onChange, onFinish,
}: Props) {
  const d = el.data as any
  const defaults = getDefaults(d)
  const editorRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<{ start: number; end: number } | null>(null)
  const finishedRef = useRef(false)
  const prevVersionRef = useRef(-1)                   // scale-only yenidənqurmanı version-dan ayırmaq üçün
  const [version, setVersion] = useState(0)          // yalnız stil tətbiqindən sonra artır
  const [restore, setRestore] = useState<{ start: number; end: number } | null>(null)
  const [uiStyle, setUiStyle] = useState(() => defaults)

  // İlk HTML + stil tətbiqindən sonrakı yenidən qurma.
  // `scale` də asılılıqdadır ki, redaktə zamanı canvas zoom olanda mətnin
  // ölçüsü overlay-də dərhal yenilənsin (əks halda köhnə miqyasda qalırdı).
  useEffect(() => {
    const node = editorRef.current
    if (!node) return
    const versionChanged = prevVersionRef.current !== version
    prevVersionRef.current = version
    const live = getSelectionOffsets(node)   // yenidənqurmadan əvvəlki cari seçim (zoom zamanı saxlamaq üçün)
    node.innerHTML = runsToHtml(getRuns(el.data), defaults, scale)
    node.focus()
    if (versionChanged) {
      if (restore) setSelectionOffsets(node, restore.start, restore.end)
      else {
        // yeni/boş mətn — hamısını seç ki dərhal yazmaq olsun
        const len = runsToPlainText(getRuns(el.data)).length
        setSelectionOffsets(node, 0, len)
      }
    } else if (live) {
      setSelectionOffsets(node, live.start, live.end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, scale])

  // Seçimi izlə — toolbar düymələri fokusu itirəndə lazım olacaq
  useEffect(() => {
    const onSelChange = () => {
      const node = editorRef.current
      if (!node) return
      const off = getSelectionOffsets(node)
      if (!off) return
      selRef.current = off
      const runs = domToRuns(node, defaults, scale)
      setUiStyle(styleAtRange(runs, off.start, Math.max(off.end, off.start + 1), defaults))
    }
    document.addEventListener('selectionchange', onSelChange)
    return () => document.removeEventListener('selectionchange', onSelChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale])

  const readRuns = useCallback((): TextRun[] => {
    const node = editorRef.current
    if (!node) return getRuns(el.data)
    return domToRuns(node, defaults, scale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale])

  const handleInput = () => {
    onChange(readRuns())
  }

  const applyPatch = (patch: Partial<TextRun>) => {
    const node = editorRef.current
    if (!node) return
    const runs = readRuns()
    const total = runsToPlainText(runs).length
    let { start, end } = selRef.current ?? { start: 0, end: total }
    if (start === end) { start = 0; end = total }   // seçim yoxdursa — hamısına
    const next = applyStyleToRuns(runs, start, end, patch)
    onChange(next)
    setRestore({ start, end })
    setVersion((v) => v + 1)
  }

  const currentSel = () => {
    const runs = readRuns()
    const total = runsToPlainText(runs).length
    const s = selRef.current ?? { start: 0, end: total }
    return { runs, ...(s.start === s.end ? { start: 0, end: total } : s) }
  }

  const toggle = (kind: 'bold' | 'italic') => {
    const { runs, start, end } = currentSel()
    const st = styleAtRange(runs, start, Math.max(end, start + 1), defaults)
    const set = new Set(st.fontStyle === 'normal' ? [] : st.fontStyle.split(/\s+/))
    if (set.has(kind)) set.delete(kind)
    else set.add(kind)
    applyPatch({ fontStyle: set.size ? Array.from(set).join(' ') : 'normal' })
  }

  const toggleUnderline = () => {
    const { runs, start, end } = currentSel()
    const st = styleAtRange(runs, start, Math.max(end, start + 1), defaults)
    applyPatch({ textDecoration: st.textDecoration === 'underline' ? 'none' : 'underline' })
  }

  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    onChange(readRuns())
    onFinish()
  }

  const bold = uiStyle.fontStyle.includes('bold')
  const italic = uiStyle.fontStyle.includes('italic')
  const underline = uiStyle.textDecoration === 'underline'

  // Toolbar düyməsi basılanda redaktor fokusu itməsin
  const keepFocus = (e: React.MouseEvent) => e.preventDefault()

  const btn = (active: boolean) =>
    `w-7 h-7 rounded-md text-sm border transition-colors ${
      active ? 'bg-indigo-600 text-white border-indigo-600'
             : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100'
    }`

  return (
    <>
      {/* ── Seçilmiş hissəyə stil verən üzən panel ── */}
      <div
        ref={toolbarRef}
        onMouseDown={keepFocus}
        style={{
          position: 'fixed',
          left: Math.max(8, left),
          top: Math.max(8, top - 46),
          zIndex: 10000,
        }}
        className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-lg px-2 py-1.5"
      >
        <select
          value={uiStyle.fontFamily}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => applyPatch({ fontFamily: e.target.value })}
          className="text-xs border border-gray-200 rounded-md px-1.5 py-1 outline-none focus:border-indigo-400 bg-white max-w-[120px]"
          style={{ fontFamily: uiStyle.fontFamily }}
          title="Şrift"
        >
          {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>

        <select
          value={SIZES.includes(Math.round(uiStyle.fontSize)) ? Math.round(uiStyle.fontSize) : ''}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => applyPatch({ fontSize: parseInt(e.target.value, 10) })}
          className="text-xs border border-gray-200 rounded-md px-1.5 py-1 outline-none focus:border-indigo-400 bg-white w-14"
          title="Ölçü"
        >
          {!SIZES.includes(Math.round(uiStyle.fontSize)) && (
            <option value="">{Math.round(uiStyle.fontSize)}</option>
          )}
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <div className="w-px h-5 bg-gray-200 mx-0.5" />

        <button onMouseDown={keepFocus} onClick={() => toggle('bold')}
          className={btn(bold) + ' font-bold'} title="Qalın">B</button>
        <button onMouseDown={keepFocus} onClick={() => toggle('italic')}
          className={btn(italic) + ' italic'} title="Kursiv">I</button>
        <button onMouseDown={keepFocus} onClick={toggleUnderline}
          className={btn(underline) + ' underline'} title="Altdan xətt">U</button>

        <div className="w-px h-5 bg-gray-200 mx-0.5" />

        <div className="flex items-center gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onMouseDown={keepFocus}
              onClick={() => applyPatch({ fill: c })}
              title={c}
              className={`w-5 h-5 rounded-md border-2 ${
                uiStyle.fill.toLowerCase() === c ? 'border-indigo-500 scale-110' : 'border-gray-200'
              }`}
              style={{ background: c }}
            />
          ))}
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(uiStyle.fill) ? uiStyle.fill : '#000000'}
            onMouseDown={keepFocus}
            onChange={(e) => applyPatch({ fill: e.target.value })}
            className="w-6 h-6 rounded-md border border-gray-200 cursor-pointer p-0.5"
            title="Xüsusi rəng"
          />
        </div>

        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <button
          onMouseDown={keepFocus}
          onClick={finish}
          className="px-2 h-7 rounded-md text-xs bg-gray-900 text-white hover:bg-gray-700"
          title="Bitir (Esc)"
        >Bitir</button>
      </div>

      {/* ── Redaktə sahəsi ── */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={(e) => {
          // Fokus toolbar-a (məs. şrift/ölçü seçicisinə) keçibsə redaktəni bitirmə —
          // əks halda dropdown açılan kimi editor bağlanırdı.
          const next = e.relatedTarget as Node | null
          if (next && toolbarRef.current?.contains(next)) return
          finish()
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') { e.preventDefault(); finish() }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggle('bold') }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); toggle('italic') }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') { e.preventDefault(); toggleUnderline() }
        }}
        onPaste={(e) => {
          // Düz mətn kimi yapışdır — kənar HTML stilləri gəlməsin
          e.preventDefault()
          const text = e.clipboardData.getData('text/plain')
          document.execCommand('insertText', false, text)
        }}
        style={{
          position: 'fixed',
          left, top,
          width:  areaW ? areaW + 'px' : 'auto',
          height: areaH ? areaH + 'px' : 'auto',
          minWidth: areaW ? undefined : 40,
          minHeight: (defaults.fontSize * (d.lineHeight ?? 1.2)) * scale,
          // Konteynerin öz şrifti runs-la eyni olmalıdır — əks halda brauzer
          // hər sətirdə görünməz defolt-şrift "strut"u yaradır (adətən 16px serif),
          // bu da runs-un ölçüsü kiçik olanda sətirarası məsafəni süni şəkildə artırır.
          fontFamily: defaults.fontFamily,
          fontSize: defaults.fontSize * scale,
          textAlign: (d.align ?? 'left') as any,
          letterSpacing: ((d.letterSpacing ?? 0) * scale) + 'px',
          lineHeight: d.lineHeight ?? 1.2,
          whiteSpace: areaW ? 'pre-wrap' : 'pre',
          wordBreak: areaW ? 'break-word' : 'normal',
          overflow: 'hidden',
          background: 'rgba(255,255,255,0.96)',
          outline: '2px solid #4f46e5',
          outlineOffset: 0,
          padding: 0,
          margin: 0,
          boxSizing: 'border-box',
          caretColor: '#4f46e5',
          zIndex: 9999,
        }}
      />
    </>
  )
}
