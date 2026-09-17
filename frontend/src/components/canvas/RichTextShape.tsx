import { useMemo, type ReactElement } from 'react'
import Konva from 'konva'
import { Group, Rect, Text } from 'react-konva'
import type { CanvasElement } from '../../types'
import { getDefaults, getRuns, layoutText, type Align } from './richText'

interface Props {
  el: CanvasElement
  draggable: boolean
  selected: boolean
  editing: boolean
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onDblClick: (e: Konva.KonvaEventObject<MouseEvent>) => void
  onDragStart: () => void
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void
  onTransform: (e: Konva.KonvaEventObject<Event>) => void
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void
}

/** Mətn elementi "area" rejimindədirmi (sabit enli qutu, mətn içində axır) */
export function isAreaText(el: CanvasElement): boolean {
  const d = el.data as any
  if (d.autoWidth) return false
  return Math.abs(d.width ?? 0) > 10
}

/** Elementin görünən ölçüsü — transformer və bbox üçün */
export function textBox(el: CanvasElement): { width: number; height: number } {
  const d = el.data as any
  const defaults = getDefaults(d)
  const area = isAreaText(el)
  const layout = layoutText({
    runs: getRuns(d),
    defaults,
    boxWidth: area ? Math.abs(d.width) : undefined,
    align: (d.align ?? 'left') as Align,
    lineHeight: d.lineHeight ?? 1.2,
    letterSpacing: d.letterSpacing ?? 0,
  })
  return area
    ? { width: Math.abs(d.width), height: Math.max(Math.abs(d.height ?? 0), 10) }
    : { width: Math.max(layout.width, 8), height: Math.max(layout.height, defaults.fontSize) }
}

export default function RichTextShape({
  el, draggable, selected, editing,
  onSelect, onDblClick, onDragStart, onDragEnd, onTransform, onTransformEnd,
}: Props) {
  const d = el.data as any
  const area = isAreaText(el)

  const { layout, defaults } = useMemo(() => {
    const def = getDefaults(d)
    return {
      defaults: def,
      layout: layoutText({
        runs: getRuns(d),
        defaults: def,
        boxWidth: area ? Math.abs(d.width) : undefined,
        align: (d.align ?? 'left') as Align,
        lineHeight: d.lineHeight ?? 1.2,
        letterSpacing: d.letterSpacing ?? 0,
      }),
    }
  }, [
    d.runs, d.text, d.fill, d.fontFamily, d.fontSize, d.fontStyle, d.textDecoration,
    d.align, d.lineHeight, d.letterSpacing, d.width, area,
  ])

  const w = area ? Math.abs(d.width) : Math.max(layout.width, 8)
  const h = area ? Math.max(Math.abs(d.height ?? 0), 10) : Math.max(layout.height, defaults.fontSize)
  const isEmpty = layout.lines.every((l) => l.segments.length === 0)

  const segments: ReactElement[] = []
  layout.lines.forEach((line, li) => {
    line.segments.forEach((seg, si) => {
      segments.push(
        <Text
          key={`${li}-${si}`}
          x={seg.x} y={seg.y}
          text={seg.text}
          fontSize={seg.style.fontSize}
          fontFamily={seg.style.fontFamily}
          fontStyle={seg.style.fontStyle}
          textDecoration={seg.style.textDecoration}
          fill={seg.style.fill}
          letterSpacing={d.letterSpacing ?? 0}
          lineHeight={1}
          wrap="none"
          listening={false}
          perfectDrawEnabled={false}
        />,
      )
    })
  })

  return (
    <Group
      id={el.id}
      name="rich-text"
      x={d.x ?? 0} y={d.y ?? 0}
      width={w} height={h}
      rotation={d.rotation ?? 0}
      opacity={d.opacity ?? 1}
      draggable={draggable}
      onClick={onSelect}
      onDblClick={onDblClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onTransform={onTransform}
      onTransformEnd={onTransformEnd}
    >
      {/* Tutma sahəsi — bütün qutu sürüklənə bilir (əvvəl listening=false idi, ona görə tutulmurdu) */}
      <Rect width={w} height={h} fill="transparent" />

      {/* Qutu sərhədi — area mətn üçün, yaxud boş mətn üçün */}
      {(area || isEmpty) && (
        <Rect
          width={w} height={h}
          stroke={selected ? '#6366f1' : '#c7d2fe'}
          strokeWidth={1}
          dash={[4, 3]}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {!editing && segments}
    </Group>
  )
}
