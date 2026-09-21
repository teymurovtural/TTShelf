import { useRef, useState } from 'react'
import { Lock, Unlock, Trash2, RotateCcw } from 'lucide-react'
import { usePageStore } from '../../store/pageStore'
import { pagesApi } from '../../api/pages'
import type { CanvasPage } from '../../types'

interface Props { canvasId: string }
interface ContextMenu { x: number; y: number; page: CanvasPage }

export default function PageSidebar({ canvasId }: Props) {
    const { pages, activePageId, switchPage, deletePage, updatePage } = usePageStore()
    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const dragItem = useRef<number | null>(null)
    const dragOver = useRef<number | null>(null)

    const handleDragStart = (idx: number) => { dragItem.current = idx }
    const handleDragEnter = (idx: number) => { dragOver.current = idx }
    const handleDragEnd = async () => {
        if (dragItem.current === null || dragOver.current === null || dragItem.current === dragOver.current) return
        const reordered = [...pages]
        const dragged = reordered.splice(dragItem.current, 1)[0]
        reordered.splice(dragOver.current, 0, dragged)
        const ids = reordered.map(p => p.id)
        usePageStore.getState().reorderPages(ids)
        try { await pagesApi.reorder(canvasId, { page_ids: ids }) }
        catch (err) { console.error('Sıralama xətası:', err) }
        dragItem.current = null; dragOver.current = null
    }

    const handleContextMenu = (e: React.MouseEvent, page: CanvasPage) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, page })
    }
    const closeMenu = () => setContextMenu(null)

    const handleToggleLock = async (page: CanvasPage) => {
        try { await pagesApi.update(canvasId, page.id, { locked: !page.locked }); updatePage(page.id, { locked: !page.locked }) }
        catch (err) { console.error('Kilid xətası:', err) }
        closeMenu()
    }

    const handleToggleOrientation = async (page: CanvasPage) => {
        const next = page.orientation === 'portrait' ? 'landscape' : 'portrait'
        try { await pagesApi.update(canvasId, page.id, { orientation: next }); updatePage(page.id, { orientation: next }) }
        catch (err) { console.error('Orientasiya xətası:', err) }
        closeMenu()
    }

    const handleDelete = async (page: CanvasPage) => {
        if (pages.length <= 1) { alert('Son səhifəni silmək olmaz'); closeMenu(); return }
        try { await deletePage(canvasId, page.id) }
        catch { alert('Səhifə silinmədi') }
        closeMenu()
    }

    const startEdit = (page: CanvasPage) => { setEditingId(page.id); setEditTitle(page.title); closeMenu() }
    const commitEdit = async (page: CanvasPage) => {
        if (editTitle.trim() && editTitle !== page.title) {
            try { await pagesApi.update(canvasId, page.id, { title: editTitle.trim() }); updatePage(page.id, { title: editTitle.trim() }) }
            catch (err) { console.error('Ad yeniləmə xətası:', err) }
        }
        setEditingId(null)
    }

    return (
        <>
            <div
                onClick={() => contextMenu && closeMenu()}
                style={{
                    width: 88, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    background: '#1e293b', borderRight: '1px solid #334155',
                }}
            >
                {/* Başlıq */}
                <div style={{
                    padding: '10px 0 8px', textAlign: 'center',
                    borderBottom: '1px solid #334155',
                }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '.6px' }}>
            Səhifələr
          </span>
                </div>

                {/* Siyahı */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {pages.map((page, idx) => {
                        const isActive = activePageId === page.id
                        return (
                            <div
                                key={page.id}
                                draggable
                                onDragStart={() => handleDragStart(idx)}
                                onDragEnter={() => handleDragEnter(idx)}
                                onDragEnd={handleDragEnd}
                                onDragOver={e => e.preventDefault()}
                                onContextMenu={e => handleContextMenu(e, page)}
                                onClick={() => switchPage(canvasId, page.id)}
                                style={{
                                    position: 'relative', cursor: 'pointer', borderRadius: 6,
                                    border: `2px solid ${isActive ? '#6366f1' : '#334155'}`,
                                    transition: 'all .15s', userSelect: 'none',
                                    boxShadow: isActive ? '0 0 0 1px #6366f1' : 'none',
                                }}
                                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = '#475569' }}
                                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.borderColor = '#334155' }}
                            >
                                {/* Səhifə preview */}
                                <div style={{
                                    width: '100%',
                                    aspectRatio: page.orientation === 'portrait' ? '1 / 1.414' : '1.414 / 1',
                                    background: '#ffffff',
                                    borderRadius: 4,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden',
                                }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>{idx + 1}</span>
                                </div>

                                {page.locked && (
                                    <div style={{ position: 'absolute', top: 4, right: 4 }}>
                                        <Lock size={9} color="#64748b" />
                                    </div>
                                )}

                                {editingId === page.id ? (
                                    <input
                                        autoFocus value={editTitle}
                                        onChange={e => setEditTitle(e.target.value)}
                                        onBlur={() => commitEdit(page)}
                                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(page); if (e.key === 'Escape') setEditingId(null) }}
                                        onClick={e => e.stopPropagation()}
                                        style={{ width: '100%', fontSize: 10, textAlign: 'center', border: 'none', outline: 'none', background: 'transparent', color: '#94a3b8', padding: '2px 4px' }}
                                    />
                                ) : (
                                    <p
                                        onDoubleClick={e => { e.stopPropagation(); startEdit(page) }}
                                        style={{ fontSize: 10, textAlign: 'center', color: isActive ? '#a5b4fc' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '3px 4px', margin: 0 }}
                                    >
                                        {page.title || `Səhifə ${idx + 1}`}
                                    </p>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Sağ klik menyusu */}
            {contextMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={closeMenu} />
                    <div style={{
                        position: 'fixed', zIndex: 50, background: '#1e293b', border: '1px solid #334155',
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.4)', padding: '4px 0', minWidth: 160,
                        top: contextMenu.y, left: contextMenu.x,
                    }}>
                        {[
                            { label: 'Ad dəyiş', onClick: () => startEdit(contextMenu.page), icon: null },
                        ].map(item => (
                            <button key={item.label} onClick={item.onClick} style={{ width: '100%', padding: '7px 14px', textAlign: 'left', fontSize: 13, color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#334155'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                                {item.label}
                            </button>
                        ))}
                        <button onClick={() => handleToggleOrientation(contextMenu.page)} style={{ width: '100%', padding: '7px 14px', textAlign: 'left', fontSize: 13, color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#334155'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                            <RotateCcw size={12} />
                            {contextMenu.page.orientation === 'portrait' ? 'Landscape et' : 'Portrait et'}
                        </button>
                        <button onClick={() => handleToggleLock(contextMenu.page)} style={{ width: '100%', padding: '7px 14px', textAlign: 'left', fontSize: 13, color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#334155'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                            {contextMenu.page.locked ? <><Unlock size={12} /> Kilidi aç</> : <><Lock size={12} /> Kilid et</>}
                        </button>
                        <div style={{ borderTop: '1px solid #334155', margin: '4px 0' }} />
                        <button onClick={() => handleDelete(contextMenu.page)} style={{ width: '100%', padding: '7px 14px', textAlign: 'left', fontSize: 13, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.1)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                            <Trash2 size={12} /> Sil
                        </button>
                    </div>
                </>
            )}
        </>
    )
}