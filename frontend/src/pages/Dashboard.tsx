import { useEffect, useState } from 'react'
import { BookOpen, Layout, Plus, Trash2, LogOut, FileText, Calendar, ChevronRight, X, Loader2, Search } from 'lucide-react'
import { booksApi } from '../api/books'
import { canvasApi } from '../api/canvas'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useBookStore } from '../store/bookStore'
import type { Canvas } from '../types'

function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.5)', backdropFilter: 'blur(4px)' }} onClick={onClose} />
        <div style={{ position: 'relative', background: 'white', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.15)', width: '100%', maxWidth: 420, padding: 28, zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{title}</h3>
            <button onClick={onClose} style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}>
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
  )
}

const inputStyle = {
  width: '100%', background: '#f8fafc', border: '1.5px solid #e2e8f0',
  borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none', display: 'block',
}

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { books, setBooks, removeBook } = useBookStore()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [tab, setTab] = useState<'books' | 'canvases'>('books')
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')

  const [canvasModal, setCanvasModal] = useState(false)
  const [canvasTitle, setCanvasTitle] = useState('')
  const [canvasLoading, setCanvasLoading] = useState(false)

  const [bookModal, setBookModal] = useState(false)
  const [bookFile, setBookFile] = useState<File | null>(null)
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')

  useEffect(() => {
    booksApi.getAll().then(res => setBooks(res.data.data.books || []))
    canvasApi.getAll().then(res => setCanvases(res.data.data.canvases || []))
  }, []) // eslint-disable-line

  const handleLogout = async () => { await authApi.logout(); logout(); window.location.href = '/login' }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setBookFile(file); setBookTitle(file.name.replace(/\.pdf$/i, '')); setBookModal(true); e.target.value = ''
  }

  const handleBookUpload = async () => {
    if (!bookFile) return
    const formData = new FormData()
    formData.append('file', bookFile)
    formData.append('title', bookTitle.trim() || bookFile.name)
    if (bookAuthor.trim()) formData.append('author', bookAuthor.trim())
    setUploading(true)
    try {
      const res = await booksApi.upload(formData)
      setBooks([...books, res.data.data])
      setBookModal(false); setBookFile(null); setBookTitle(''); setBookAuthor('')
    } catch (err: any) { alert(err.response?.data?.error?.message || 'Yükləmə xətası') }
    finally { setUploading(false) }
  }

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Kitabı silmək istəyirsiniz?')) return
    await booksApi.delete(id); removeBook(id)
  }

  const handleCreateCanvas = async () => {
    if (!canvasTitle.trim()) return
    setCanvasLoading(true)
    try {
      const res = await canvasApi.create({ title: canvasTitle.trim() })
      window.location.href = `/editor/${res.data.data.id}`
    } catch { alert('Canvas yaradıla bilmədi') }
    finally { setCanvasLoading(false) }
  }

  const handleOpenBook = async (bookId: string, title: string) => {
    try {
      const existing = canvases.find(c => c.book_id === bookId)
      if (existing) { window.location.href = `/editor/${existing.id}?book=${bookId}`; return }
      const res = await canvasApi.create({ title, book_id: bookId })
      const newCanvas = res.data.data
      setCanvases(prev => [...prev, newCanvas])
      window.location.href = `/editor/${newCanvas.id}?book=${bookId}`
    } catch { alert('Canvas yaradıla bilmədi') }
  }

  const handleDeleteCanvas = async (id: string) => {
    if (!confirm('Canvas-ı silmək istəyirsiniz?')) return
    await canvasApi.delete(id); setCanvases(canvases.filter(c => c.id !== id))
  }

  const formatSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' })

  const filteredBooks = books.filter(b => b.title.toLowerCase().includes(search.toLowerCase()) || b.author?.toLowerCase().includes(search.toLowerCase()))
  const filteredCanvases = canvases.filter(c => c.title.toLowerCase().includes(search.toLowerCase()))

  return (
      <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
        {/* Header */}
        <header style={{ background: 'var(--dark)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <span style={{ color: 'white', fontWeight: 700, fontSize: 16, letterSpacing: '-0.2px' }}>TTShelf</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {user && <span style={{ color: '#64748b', fontSize: 13 }}>@{user.username}</span>}
              <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                <LogOut size={14} /> Çıxış
              </button>
            </div>
          </div>
        </header>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                Salam, {user?.name?.split(' ')[0] || user?.username} 👋
              </h1>
              <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 2 }}>
                {books.length} kitab · {canvases.length} canvas
              </p>
            </div>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Axtar..."
                     style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 13, outline: 'none', width: 220 }} />
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: 4, width: 'fit-content' }}>
            {([
              { key: 'books', label: 'Kitablar', icon: <BookOpen size={14} />, count: books.length },
              { key: 'canvases', label: 'Canvas-lar', icon: <Layout size={14} />, count: canvases.length },
            ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8,
                  fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all .15s',
                  background: tab === t.key ? 'var(--accent)' : 'transparent',
                  color: tab === t.key ? 'white' : 'var(--text-2)',
                }}>
                  {t.icon} {t.label}
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
                    background: tab === t.key ? 'rgba(255,255,255,.2)' : '#f1f5f9',
                    color: tab === t.key ? 'white' : '#64748b',
                  }}>{t.count}</span>
                </button>
            ))}
          </div>

          {/* Books */}
          {tab === 'books' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Kitablarım</h2>
                  <label style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                    background: 'var(--accent)', color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? .6 : 1,
                  }}>
                    <Plus size={14} /> PDF əlavə et
                    <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileSelect} />
                  </label>
                </div>

                {filteredBooks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                      <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <BookOpen size={28} color="#cbd5e1" />
                      </div>
                      <p style={{ fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Hələ kitab yoxdur</p>
                      <p style={{ fontSize: 13 }}>PDF yükləyib qeyd aparmağa başlayın</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                      {filteredBooks.map(book => {
                        const linked = canvases.find(c => c.book_id === book.id)
                        return (
                            <div key={book.id} style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transition: 'border-color .15s, box-shadow .15s' }}
                                 onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,.08)' }}
                                 onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ width: 40, height: 40, background: '#eef2ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <FileText size={18} color="#6366f1" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <h3 style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</h3>
                                  {book.author && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</p>}
                                </div>
                                <button onClick={() => handleDeleteBook(book.id)} style={{ color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0 }}
                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#cbd5e1'}>
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#94a3b8' }}>
                                <span>{book.total_pages} səh.</span>
                                <span>·</span>
                                <span>{formatSize(book.file_size)}</span>
                                {book.last_page > 1 && <><span>·</span><span style={{ color: 'var(--accent)' }}>{book.last_page}-ci səh.</span></>}
                              </div>

                              {linked && (
                                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 10px', fontSize: 12, color: '#16a34a' }}>
                                    📋 {linked.title}
                                  </div>
                              )}

                              <button onClick={() => handleOpenBook(book.id, book.title)} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10,
                                padding: '9px 0', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer', transition: 'all .15s',
                              }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff'; (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}>
                                {linked ? 'Canvas-ı aç' : 'Oxu / Qeyd apar'} <ChevronRight size={14} />
                              </button>
                            </div>
                        )
                      })}
                    </div>
                )}
              </div>
          )}

          {/* Canvases */}
          {tab === 'canvases' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Canvas-larım</h2>
                  <button onClick={() => { setCanvasTitle(''); setCanvasModal(true) }} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                    background: 'var(--accent)', color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: 'none',
                  }}>
                    <Plus size={14} /> Yeni Canvas
                  </button>
                </div>

                {filteredCanvases.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                      <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Layout size={28} color="#cbd5e1" />
                      </div>
                      <p style={{ fontWeight: 500, color: '#64748b', marginBottom: 4 }}>Hələ canvas yoxdur</p>
                      <p style={{ fontSize: 13 }}>Yeni canvas yaradıb qeydlər aparmağa başlayın</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                      {filteredCanvases.map(canvas => (
                          <div key={canvas.id} style={{ background: 'white', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transition: 'all .15s' }}
                               onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,.08)' }}
                               onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                                <div style={{ width: 40, height: 40, background: '#f5f3ff', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Layout size={18} color="#8b5cf6" />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <h3 style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{canvas.title}</h3>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                                    <Calendar size={11} /> {formatDate(canvas.updated_at)}
                                  </div>
                                </div>
                              </div>
                              <button onClick={() => handleDeleteCanvas(canvas.id)} style={{ color: '#cbd5e1', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0 }}
                                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#ef4444'}
                                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#cbd5e1'}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                            <button onClick={() => { window.location.href = canvas.book_id ? `/editor/${canvas.id}?book=${canvas.book_id}` : `/editor/${canvas.id}` }}
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                      background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10,
                                      padding: '9px 0', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', cursor: 'pointer', transition: 'all .15s',
                                    }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#eef2ff'; (e.currentTarget as HTMLElement).style.borderColor = '#c7d2fe'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)' }}>
                              Aç <ChevronRight size={14} />
                            </button>
                          </div>
                      ))}
                    </div>
                )}
              </div>
          )}
        </div>

        {/* Canvas Modal */}
        <Modal open={canvasModal} title="Yeni Canvas" onClose={() => setCanvasModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Canvas adı</label>
              <input type="text" value={canvasTitle} onChange={e => setCanvasTitle(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleCreateCanvas()}
                     placeholder="Canvas adını daxil edin" autoFocus style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setCanvasModal(false)} style={{ flex: 1, padding: '10px 0', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: 'var(--text-2)', background: 'white', cursor: 'pointer' }}>Ləğv et</button>
              <button onClick={handleCreateCanvas} disabled={!canvasTitle.trim() || canvasLoading} style={{
                flex: 1, padding: '10px 0', background: 'var(--accent)', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: !canvasTitle.trim() || canvasLoading ? .6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {canvasLoading && <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} />} Yarat
              </button>
            </div>
          </div>
        </Modal>

        {/* Book Upload Modal */}
        <Modal open={bookModal} title="Kitab əlavə et" onClose={() => setBookModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>Kitab adı</label>
              <input type="text" value={bookTitle} onChange={e => setBookTitle(e.target.value)} placeholder="Kitabın adı" autoFocus style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 6 }}>
                Müəllif <span style={{ color: '#94a3b8', fontWeight: 400 }}>(istəyə bağlı)</span>
              </label>
              <input type="text" value={bookAuthor} onChange={e => setBookAuthor(e.target.value)} placeholder="Müəllifin adı" style={inputStyle} />
            </div>
            {bookFile && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#64748b' }}>
                  📄 {bookFile.name} — {formatSize(bookFile.size)}
                </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setBookModal(false)} style={{ flex: 1, padding: '10px 0', border: '1.5px solid #e2e8f0', borderRadius: 10, fontSize: 13, color: 'var(--text-2)', background: 'white', cursor: 'pointer' }}>Ləğv et</button>
              <button onClick={handleBookUpload} disabled={!bookTitle.trim() || uploading} style={{
                flex: 1, padding: '10px 0', background: 'var(--accent)', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 500, color: 'white', cursor: 'pointer', opacity: !bookTitle.trim() || uploading ? .6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                {uploading && <Loader2 size={14} style={{ animation: 'spin .7s linear infinite' }} />}
                {uploading ? 'Yüklənir...' : 'Yüklə'}
              </button>
            </div>
          </div>
        </Modal>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
  )
}