import type { ElementData } from '../../types'

/* ═══════════════════════════════════════════════════════════
   RICH TEXT — model, ölçmə, sətir düzümü (Illustrator məntiqi)
   Mətn "run"lardan ibarətdir. Hər run-un öz rəngi, fontu,
   ölçüsü ola bilər → mətnin bir hissəsini seçib dəyişmək mümkündür.
   ═══════════════════════════════════════════════════════════ */

export interface TextRun {
  text: string
  fill?: string
  fontFamily?: string
  fontSize?: number
  fontStyle?: string        // 'normal' | 'bold' | 'italic' | 'bold italic'
  textDecoration?: string   // 'none' | 'underline'
}

export interface ResolvedStyle {
  fill: string
  fontFamily: string
  fontSize: number
  fontStyle: string
  textDecoration: string
}

export type Align = 'left' | 'center' | 'right'

/* ---------- defaults / runs ---------- */

export function getDefaults(d: ElementData): ResolvedStyle {
  return {
    fill:           d.fill || '#0f172a',
    fontFamily:     d.fontFamily || 'Arial',
    fontSize:       d.fontSize || 20,
    fontStyle:      (d as any).fontStyle || 'normal',
    textDecoration: (d as any).textDecoration || 'none',
  }
}

export function getRuns(d: ElementData): TextRun[] {
  const runs = (d as any).runs as TextRun[] | undefined
  if (Array.isArray(runs) && runs.length) {
    const ok = runs.filter((r) => r && typeof r.text === 'string')
    if (ok.length) return ok
  }
  return [{ text: d.text ?? '' }]
}

export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join('')
}

export function resolveStyle(run: TextRun, def: ResolvedStyle): ResolvedStyle {
  return {
    fill:           run.fill           ?? def.fill,
    fontFamily:     run.fontFamily     ?? def.fontFamily,
    fontSize:       run.fontSize       ?? def.fontSize,
    fontStyle:      run.fontStyle      ?? def.fontStyle,
    textDecoration: run.textDecoration ?? def.textDecoration,
  }
}

/** Qonşu eyni stilli run-ları birləşdir, boşları at */
export function mergeRuns(runs: TextRun[]): TextRun[] {
  const out: TextRun[] = []
  for (const r of runs) {
    if (!r.text) continue
    const last = out[out.length - 1]
    if (last && sameStyle(last, r)) last.text += r.text
    else out.push({ ...r })
  }
  return out.length ? out : [{ text: '' }]
}

function sameStyle(a: TextRun, b: TextRun): boolean {
  return a.fill === b.fill && a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize && a.fontStyle === b.fontStyle &&
    a.textDecoration === b.textDecoration
}

/** Seçilmiş [start,end) aralığına stil tətbiq et — run-ları bölərək */
export function applyStyleToRuns(
  runs: TextRun[], start: number, end: number, patch: Partial<TextRun>,
): TextRun[] {
  if (end <= start) return runs
  const out: TextRun[] = []
  let pos = 0
  for (const run of runs) {
    const len = run.text.length
    const s = Math.max(start, pos)
    const e = Math.min(end, pos + len)
    if (e <= s) {
      out.push(run)
    } else {
      const a = run.text.slice(0, s - pos)
      const b = run.text.slice(s - pos, e - pos)
      const c = run.text.slice(e - pos)
      if (a) out.push({ ...run, text: a })
      out.push({ ...run, ...patch, text: b })
      if (c) out.push({ ...run, text: c })
    }
    pos += len
  }
  return mergeRuns(out)
}

/** Aralıqdakı ilk run-un stili — panel/toolbar göstəricisi üçün */
export function styleAtRange(
  runs: TextRun[], start: number, end: number, def: ResolvedStyle,
): ResolvedStyle {
  let pos = 0
  for (const run of runs) {
    const len = run.text.length
    if (start < pos + len && (end > pos || start === pos)) return resolveStyle(run, def)
    pos += len
  }
  const last = runs[runs.length - 1]
  return last ? resolveStyle(last, def) : def
}

/* ---------- ölçmə ---------- */

let measureCtx: CanvasRenderingContext2D | null = null
const widthCache = new Map<string, number>()

export function fontCss(s: { fontStyle: string; fontSize: number; fontFamily: string }): string {
  const st = s.fontStyle || 'normal'
  const italic = st.includes('italic') ? 'italic ' : ''
  const bold   = st.includes('bold')   ? 'bold '   : ''
  return `${italic}${bold}${s.fontSize}px ${s.fontFamily}`
}

function measureText(text: string, css: string): number {
  if (!text) return 0
  const key = css + '\u0000' + text
  const hit = widthCache.get(key)
  if (hit !== undefined) return hit
  if (!measureCtx) {
    const c = document.createElement('canvas')
    measureCtx = c.getContext('2d')
  }
  if (!measureCtx) return text.length * 8
  measureCtx.font = css
  const w = measureCtx.measureText(text).width
  if (widthCache.size > 8000) widthCache.clear()
  widthCache.set(key, w)
  return w
}

function pieceWidth(text: string, style: ResolvedStyle, letterSpacing: number): number {
  return measureText(text, fontCss(style)) + letterSpacing * text.length
}

/* ---------- sətir düzümü ---------- */

export interface LaidSegment {
  x: number; y: number
  text: string
  style: ResolvedStyle
}
export interface LaidLine {
  y: number; height: number; width: number
  segments: LaidSegment[]
}
export interface TextLayout {
  lines: LaidLine[]
  width: number
  height: number
}

// Konva Text qlifi em-qutusunun ortasında çəkir; baza xətti ≈ y + K*fontSize.
// Fərqli ölçülü run-ların baza xəttini eyni səviyyəyə gətirmək üçün istifadə olunur.
const BASELINE_K = 0.86

interface Piece { text: string; style: ResolvedStyle; width: number }
interface Token { pieces: Piece[]; width: number; kind: 'word' | 'space' | 'newline' }

export function layoutText(opts: {
  runs: TextRun[]
  defaults: ResolvedStyle
  boxWidth?: number          // undefined → avtomatik en (nöqtə mətni)
  align?: Align
  lineHeight?: number
  letterSpacing?: number
}): TextLayout {
  const { runs, defaults, boxWidth } = opts
  const align = opts.align ?? 'left'
  const lineHeight = opts.lineHeight ?? 1.2
  const ls = opts.letterSpacing ?? 0

  // 1. simvol + stil axını
  const chars: { ch: string; style: ResolvedStyle }[] = []
  for (const run of runs) {
    const st = resolveStyle(run, defaults)
    for (const ch of run.text) chars.push({ ch, style: st })
  }

  // 2. token-lərə böl (söz / boşluq / sətir keçidi)
  const tokens: Token[] = []
  let i = 0
  const makeToken = (from: number, to: number, kind: Token['kind']): Token => {
    const pieces: Piece[] = []
    for (let k = from; k < to; k++) {
      const { ch, style } = chars[k]
      const last = pieces[pieces.length - 1]
      if (last && last.style === style) last.text += ch
      else pieces.push({ text: ch, style, width: 0 })
    }
    let w = 0
    for (const p of pieces) { p.width = pieceWidth(p.text, p.style, ls); w += p.width }
    return { pieces, width: w, kind }
  }
  while (i < chars.length) {
    const ch = chars[i].ch
    if (ch === '\n') { tokens.push({ pieces: [], width: 0, kind: 'newline' }); i++; continue }
    const isSpace = ch === ' ' || ch === '\t'
    let j = i + 1
    while (j < chars.length) {
      const c = chars[j].ch
      if (c === '\n') break
      const cSpace = c === ' ' || c === '\t'
      if (cSpace !== isSpace) break
      j++
    }
    tokens.push(makeToken(i, j, isSpace ? 'space' : 'word'))
    i = j
  }

  // 3. sətirlərə yığ
  const rawLines: Piece[][] = []
  let cur: Piece[] = []
  let curW = 0
  const pushLine = () => { rawLines.push(cur); cur = []; curW = 0 }

  const appendToken = (t: Token) => {
    for (const p of t.pieces) {
      const last = cur[cur.length - 1]
      if (last && last.style === p.style) { last.text += p.text; last.width += p.width }
      else cur.push({ ...p })
    }
    curW += t.width
  }

  for (const t of tokens) {
    if (t.kind === 'newline') { pushLine(); continue }
    if (boxWidth && curW + t.width > boxWidth && cur.length > 0) {
      pushLine()
      if (t.kind === 'space') continue          // sətir başındakı boşluq atılır
    }
    if (boxWidth && t.width > boxWidth && cur.length === 0 && t.kind === 'word') {
      // Tək söz qutudan uzundur → hərf-hərf qır
      for (const p of t.pieces) {
        for (const ch of p.text) {
          const w = pieceWidth(ch, p.style, ls)
          if (curW + w > boxWidth && cur.length > 0) pushLine()
          const last = cur[cur.length - 1]
          if (last && last.style === p.style) { last.text += ch; last.width += w }
          else cur.push({ text: ch, style: p.style, width: w })
          curW += w
        }
      }
      continue
    }
    appendToken(t)
  }
  pushLine()

  // 4. koordinatlar
  const lines: LaidLine[] = []
  let y = 0
  let maxW = 0
  for (const pieces of rawLines) {
    const lineW = pieces.reduce((s, p) => s + p.width, 0)
    const maxFont = pieces.length
      ? Math.max(...pieces.map((p) => p.style.fontSize))
      : defaults.fontSize
    const boxH = maxFont * lineHeight
    const baseTop = y + (boxH - maxFont) / 2
    const baseline = baseTop + BASELINE_K * maxFont
    lines.push({ y, height: boxH, width: lineW, segments: pieces.map((p) => ({
      x: 0, y: baseline - BASELINE_K * p.style.fontSize, text: p.text, style: p.style,
    })) })
    // x-ləri doldur
    const line = lines[lines.length - 1]
    let x = 0
    for (let k = 0; k < pieces.length; k++) { line.segments[k].x = x; x += pieces[k].width }
    maxW = Math.max(maxW, lineW)
    y += boxH
  }

  // 5. hizalama
  const contentW = boxWidth ?? maxW
  if (align !== 'left') {
    for (const line of lines) {
      const off = align === 'center' ? (contentW - line.width) / 2 : contentW - line.width
      for (const s of line.segments) s.x += off
    }
  }

  return { lines, width: contentW, height: y }
}

/* ═══════════════════════════════════════════════════════════
   HTML ⇄ runs  (contentEditable redaktoru üçün)
   ═══════════════════════════════════════════════════════════ */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function runsToHtml(runs: TextRun[], def: ResolvedStyle, scale = 1): string {
  const parts: string[] = []
  for (const run of runs) {
    const st = resolveStyle(run, def)
    const css = [
      `color:${st.fill}`,
      `font-family:${st.fontFamily}`,
      `font-size:${st.fontSize * scale}px`,
      `font-weight:${st.fontStyle.includes('bold') ? 700 : 400}`,
      `font-style:${st.fontStyle.includes('italic') ? 'italic' : 'normal'}`,
      `text-decoration:${st.textDecoration === 'underline' ? 'underline' : 'none'}`,
    ].join(';')
    const html = escapeHtml(run.text).split('\n').join('<br>')
    parts.push(`<span style="${css}">${html}</span>`)
  }
  const joined = parts.join('')
  return joined || '<span><br></span>'
}

function styleFromEl(el: HTMLElement, inherited: Partial<TextRun>): Partial<TextRun> {
  const out: Partial<TextRun> = { ...inherited }
  const s = el.style
  const cs = el.getAttribute('color')
  if (s.color) out.fill = normalizeColor(s.color)
  else if (cs) out.fill = normalizeColor(cs)
  if (s.fontFamily) out.fontFamily = s.fontFamily.replace(/["']/g, '').split(',')[0].trim()
  if (s.fontSize && s.fontSize.endsWith('px')) out.fontSize = parseFloat(s.fontSize)
  const tag = el.tagName
  const bold = tag === 'B' || tag === 'STRONG' ||
    s.fontWeight === 'bold' || parseInt(s.fontWeight || '0', 10) >= 600
  const italic = tag === 'I' || tag === 'EM' || s.fontStyle === 'italic'
  const plain = s.fontWeight === 'normal' || parseInt(s.fontWeight || '0', 10) > 0 && parseInt(s.fontWeight, 10) < 600
  if (bold || italic) {
    const cur = out.fontStyle ?? 'normal'
    const set = new Set(cur === 'normal' ? [] : cur.split(/\s+/))
    if (bold) set.add('bold')
    if (italic) set.add('italic')
    out.fontStyle = set.size ? Array.from(set).join(' ') : 'normal'
  } else if (plain && s.fontStyle === 'normal') {
    out.fontStyle = 'normal'
  }
  if (tag === 'U' || (s.textDecoration && s.textDecoration.includes('underline')) ||
      (s.textDecorationLine && s.textDecorationLine.includes('underline'))) {
    out.textDecoration = 'underline'
  } else if (s.textDecoration === 'none' || s.textDecorationLine === 'none') {
    out.textDecoration = 'none'
  }
  return out
}

function normalizeColor(c: string): string {
  const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (!m) return c.trim()
  const hex = (n: string) => parseInt(n, 10).toString(16).padStart(2, '0')
  return '#' + hex(m[1]) + hex(m[2]) + hex(m[3])
}

/** contentEditable DOM → run-lar. scale: redaktordakı px-i canvas px-inə çevirmək üçün */
export function domToRuns(root: HTMLElement, def: ResolvedStyle, scale = 1): TextRun[] {
  const runs: TextRun[] = []
  let needNewlineBefore = false

  const walk = (node: Node, inherited: Partial<TextRun>) => {
    if (node.nodeType === Node.TEXT_NODE) {
      let text = (node.nodeValue || '').replace(/\u00a0/g, ' ')
      if (!text) return
      if (needNewlineBefore) { text = '\n' + text; needNewlineBefore = false }
      runs.push({ ...inherited, text })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.tagName === 'BR') {
      runs.push({ ...inherited, text: '\n' })
      needNewlineBefore = false
      return
    }
    const isBlock = ['DIV', 'P', 'LI'].includes(el.tagName)
    if (isBlock && runs.length > 0) needNewlineBefore = true
    const st = styleFromEl(el, inherited)
    for (const child of Array.from(el.childNodes)) walk(child, st)
  }

  for (const child of Array.from(root.childNodes)) walk(child, {})

  // scale-i geri al + default-la üst-üstə düşənləri təmizlə
  const norm = runs.map((r) => {
    const out: TextRun = { text: r.text }
    if (r.fill !== undefined && r.fill !== def.fill) out.fill = r.fill
    if (r.fontFamily !== undefined && r.fontFamily !== def.fontFamily) out.fontFamily = r.fontFamily
    if (r.fontSize !== undefined) {
      const fs = Math.round((r.fontSize / scale) * 100) / 100
      if (Math.abs(fs - def.fontSize) > 0.01) out.fontSize = fs
    }
    if (r.fontStyle !== undefined && r.fontStyle !== def.fontStyle) out.fontStyle = r.fontStyle
    if (r.textDecoration !== undefined && r.textDecoration !== def.textDecoration) {
      out.textDecoration = r.textDecoration
    }
    return out
  })
  return mergeRuns(norm)
}

/* ---------- seçim (caret) mövqeyi ⇄ simvol indeksi ---------- */

function nodeLength(node: Node): number {
  if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue || '').length
  if (node.nodeName === 'BR') return 1
  let total = 0
  for (const c of Array.from(node.childNodes)) total += nodeLength(c)
  return total
}

function offsetOf(root: Node, target: Node, targetOffset: number): number {
  let total = 0
  const walk = (node: Node): boolean => {
    if (node === target) {
      if (node.nodeType === Node.TEXT_NODE) { total += targetOffset; return true }
      const kids = Array.from(node.childNodes)
      for (let i = 0; i < targetOffset && i < kids.length; i++) total += nodeLength(kids[i])
      return true
    }
    if (node.nodeType === Node.TEXT_NODE) { total += (node.nodeValue || '').length; return false }
    if (node.nodeName === 'BR') { total += 1; return false }
    for (const c of Array.from(node.childNodes)) if (walk(c)) return true
    return false
  }
  walk(root)
  return total
}

export function getSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const r = sel.getRangeAt(0)
  if (!root.contains(r.startContainer) || !root.contains(r.endContainer)) return null
  const start = offsetOf(root, r.startContainer, r.startOffset)
  const end   = offsetOf(root, r.endContainer,   r.endOffset)
  return start <= end ? { start, end } : { start: end, end: start }
}

export function setSelectionOffsets(root: HTMLElement, start: number, end: number) {
  const locate = (target: number): { node: Node; offset: number } => {
    let acc = 0
    let result: { node: Node; offset: number } | null = null
    const walk = (node: Node): boolean => {
      if (node.nodeType === Node.TEXT_NODE) {
        const len = (node.nodeValue || '').length
        if (acc + len >= target) { result = { node, offset: target - acc }; return true }
        acc += len
        return false
      }
      if (node.nodeName === 'BR') {
        if (acc + 1 > target) {
          const parent = node.parentNode!
          result = { node: parent, offset: Array.from(parent.childNodes).indexOf(node as ChildNode) }
          return true
        }
        acc += 1
        return false
      }
      for (const c of Array.from(node.childNodes)) if (walk(c)) return true
      return false
    }
    walk(root)
    return result ?? { node: root, offset: root.childNodes.length }
  }
  const a = locate(start)
  const b = start === end ? a : locate(end)
  const range = document.createRange()
  try {
    range.setStart(a.node, a.offset)
    range.setEnd(b.node, b.offset)
  } catch {
    return
  }
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
