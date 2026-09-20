import { useRef, useState } from 'react'
import { Lock, Unlock, Trash2, RotateCcw } from 'lucide-react'
import { usePageStore } from '../../store/pageStore'
import { pagesApi } from '../../api/pages'
import type { CanvasPage } from '../../types'

interface Props {
    canvasId: string
}

interface ContextMenu {
    x: number
    y: number
    page: CanvasPage
}

export default function PageSidebar({ canvasId }: Props) {
    const {
        pages,
        activePageId,
        switchPage,
        deletePage,
        updatePage,
    } = usePageStore()

    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState('')
    const dragItem = useRef<number | null>(null)
    const dragOver = useRef<number | null>(null)
    const listRef  = useRef<HTMLDivElement>(null)

    // --- Drag & Drop sıralama ---
    const handleDragStart = (idx: number) => { dragItem.current = idx }
    const handleDragEnter = (idx: number) => { dragOver.current = idx }

    const handleDragEnd = async () => {
        if (dragItem.current === null || dragOver.current === null) return
        if (dragItem.current === dragOver.current) return
        const reordered = [...pages]
        const dragged = reordered.splice(dragItem.current, 1)[0]
        reordered.splice(dragOver.current, 0, dragged)
        const ids = reordered.map((p) => p.id)
        usePageStore.getState().reorderPages(ids)
        try { await pagesApi.reorder(canvasId, { page_ids: ids }) }
        catch (err) { console.error('Sıralama xətası:', err) }
        dragItem.current = null
        dragOver.current = null
    }

    // --- Sağ klik menyusu ---
    const handleContextMenu = (e: React.MouseEvent, page: CanvasPage) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, page })
    }
    const closeMenu = () => setContextMenu(null)

    const handleToggleLock = async (page: CanvasPage) => {
        try {
            await pagesApi.update(canvasId, page.id, { locked: !page.locked })
            updatePage(page.id, { locked: !page.locked })
        } catch (err) { console.error('Kilid xətası:', err) }
        closeMenu()
    }

    const handleToggleOrientation = async (page: CanvasPage) => {
        const next = page.orientation === 'portrait' ? 'landscape' : 'portrait'
        try {
            await pagesApi.update(canvasId, page.id, { orientation: next })
            updatePage(page.id, { orientation: next })
        } catch (err) { console.error('Orientasiya xətası:', err) }
        closeMenu()
    }

    const handleDelete = async (page: CanvasPage) => {
        if (pages.length <= 1) { alert('Son səhifəni silmək olmaz'); closeMenu(); return }
        try { await deletePage(canvasId, page.id) }
        catch { alert('Səhifə silinmədi') }
        closeMenu()
    }

    // --- Ad dəyişmə ---
    const startEdit = (page: CanvasPage) => {
        setEditingId(page.id)
        setEditTitle(page.title)
        closeMenu()
    }

    const commitEdit = async (page: CanvasPage) => {
        if (editTitle.trim() && editTitle !== page.title) {
            try {
                await pagesApi.update(canvasId, page.id, { title: editTitle.trim() })
                updatePage(page.id, { title: editTitle.trim() })
            } catch (err) { console.error('Ad yeniləmə xətası:', err) }
        }
        setEditingId(null)
    }

    return (
        <>
            <div
                className="flex flex-col bg-gray-50 border-r border-gray-200 shrink-0"
                style={{ width: 160 }}
                onClick={() => contextMenu && closeMenu()}
            >
                <div
                    ref={listRef}
                    className="flex-1 py-2 px-2 flex flex-col gap-2 overflow-y-auto"
                >
                    {pages.map((page, idx) => (
                        <div
                            key={page.id}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragEnter={() => handleDragEnter(idx)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onContextMenu={(e) => handleContextMenu(e, page)}
                            onClick={() => switchPage(canvasId, page.id)}
                            className={[
                                'relative cursor-pointer rounded-md border-2 transition-all select-none',
                                activePageId === page.id
                                    ? 'border-indigo-500 shadow-md'
                                    : 'border-gray-200 hover:border-gray-300',
                            ].join(' ')}
                        >
                            <div
                                className="bg-white rounded flex items-center justify-center overflow-hidden"
                                style={{
                                    width: '100%',
                                    aspectRatio: page.orientation === 'portrait' ? '1 / 1.414' : '1.414 / 1',
                                }}
                            >
                                <span className="text-gray-300 text-xs font-medium">{idx + 1}</span>
                            </div>

                            {page.locked && (
                                <div className="absolute top-1 right-1">
                                    <Lock size={10} className="text-gray-400" />
                                </div>
                            )}

                            {editingId === page.id ? (
                                <input
                                    autoFocus
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    onBlur={() => commitEdit(page)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitEdit(page)
                                        if (e.key === 'Escape') setEditingId(null)
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full text-xs text-center border-none outline-none bg-transparent px-1 mt-1"
                                />
                            ) : (
                                <p
                                    className="text-xs text-center text-gray-500 truncate px-1 mt-1 mb-1"
                                    onDoubleClick={(e) => { e.stopPropagation(); startEdit(page) }}
                                >
                                    {page.title || `Səhifə ${idx + 1}`}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
                {/* + Yeni səhifə düyməsi ÇIXARILDI — indi A4-ün sağında */}
            </div>

            {/* Sağ klik menyusu */}
            {contextMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={closeMenu} />
                    <div
                        className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-40"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    >
                        <button
                            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => startEdit(contextMenu.page)}
                        >
                            Ad dəyiş
                        </button>
                        <button
                            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => handleToggleOrientation(contextMenu.page)}
                        >
                            <RotateCcw size={13} />
                            {contextMenu.page.orientation === 'portrait' ? 'Landscape et' : 'Portrait et'}
                        </button>
                        <button
                            className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => handleToggleLock(contextMenu.page)}
                        >
                            {contextMenu.page.locked
                                ? <><Unlock size={13} /> Kilidi aç</>
                                : <><Lock size={13} /> Kilid et</>
                            }
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                        <button
                            className="w-full px-3 py-1.5 text-left text-sm text-red-500 hover:bg-red-50 flex items-center gap-2"
                            onClick={() => handleDelete(contextMenu.page)}
                        >
                            <Trash2 size={13} />
                            Sil
                        </button>
                    </div>
                </>
            )}
        </>
    )
}