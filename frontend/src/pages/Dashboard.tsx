import { useEffect, useState } from 'react'
import {
  BookOpen, Layout, Plus, Trash2, LogOut,
  FileText, Calendar, ChevronRight, X, Loader2
} from 'lucide-react'
import { booksApi } from '../api/books'
import { canvasApi } from '../api/canvas'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useBookStore } from '../store/bookStore'
import type { Canvas } from '../types'

// ---- Modal ----
function Modal({
  open, title, onClose, children,
}: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-lg p-1">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, logout } = useAuthStore()
  const { books, setBooks, removeBook } = useBookStore()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [tab, setTab] = useState<'books' | 'canvases'>('books')
  const [uploading, setUploading] = useState(false)

  // Canvas modal
  const [canvasModal, setCanvasModal] = useState(false)
  const [canvasTitle, setCanvasTitle] = useState('')
  const [canvasLoading, setCanvasLoading] = useState(false)

  // Book modal
  const [bookModal, setBookModal] = useState(false)
  const [bookFile, setBookFile] = useState<File | null>(null)
  const [bookTitle, setBookTitle] = useState('')
  const [bookAuthor, setBookAuthor] = useState('')

  useEffect(() => {
    booksApi.getAll().then((res) => setBooks(res.data.data.books || []))
    canvasApi.getAll().then((res) => setCanvases(res.data.data.canvases || []))
  }, [])

  const handleLogout = async () => {
    await authApi.logout()
    logout()
    window.location.href = '/login'
  }

  // --- Book upload ---
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBookFile(file)
    setBookTitle(file.name.replace(/\.pdf$/i, ''))
    setBookModal(true)
    e.target.value = ''
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
      setBookModal(false)
      setBookFile(null)
      setBookTitle('')
      setBookAuthor('')
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Yükləmə xətası')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Kitabı silmək istəyirsiniz?')) return
    await booksApi.delete(id)
    removeBook(id)
  }

  // --- Canvas ---
  const handleCreateCanvas = async () => {
    if (!canvasTitle.trim()) return
    setCanvasLoading(true)
    try {
      const res = await canvasApi.create({ title: canvasTitle.trim() })
      window.location.href = `/editor/${res.data.data.id}`
    } catch {
      alert('Canvas yaradıla bilmədi')
    } finally {
      setCanvasLoading(false)
    }
  }

  const handleOpenBook = async (bookId: string, title: string) => {
    try {
      const res = await canvasApi.create({ title, book_id: bookId })
      window.location.href = `/editor/${res.data.data.id}?book=${bookId}`
    } catch {
      alert('Canvas yaradıla bilmədi')
    }
  }

  const handleDeleteCanvas = async (id: string) => {
    if (!confirm('Canvas-ı silmək istəyirsiniz?')) return
    await canvasApi.delete(id)
    setCanvases(canvases.filter((c) => c.id !== id))
  }

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen size={14} className="text-white" />
            </div>
            <span className="font-bold text-gray-900">TTShelf</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-500 hidden sm:block">
                @{user.username}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
            >
              <LogOut size={15} />
              Çıxış
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-8 bg-gray-100 p-1 rounded-xl w-fit">
          {([
            { key: 'books', label: 'Kitablar', icon: <BookOpen size={15} />, count: books.length },
            { key: 'canvases', label: 'Canvas-lar', icon: <Layout size={15} />, count: canvases.length },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${
                tab === t.key ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500'
              }`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Books tab */}
        {tab === 'books' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Kitablarım</h2>
              <label className={`flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium cursor-pointer transition-colors ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                <Plus size={15} />
                PDF əlavə et
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
              </label>
            </div>

            {books.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen size={28} className="text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">Hələ kitab yoxdur</p>
                <p className="text-sm mt-1">PDF yükləyib qeyd aparmağa başlayın</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map((book) => (
                  <div key={book.id}
                    className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:border-gray-300 hover:shadow-sm transition-all group">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate text-sm">{book.title}</h3>
                        {book.author && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">{book.author}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{book.total_pages} səh.</span>
                      <span>•</span>
                      <span>{formatSize(book.file_size)}</span>
                      {book.last_page > 1 && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-500">{book.last_page}-ci səh.</span>
                        </>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenBook(book.id, book.title)}
                      className="mt-auto w-full flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 text-gray-700 text-sm py-2.5 rounded-xl transition-all font-medium"
                    >
                      Oxu / Qeyd apar
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Canvases tab */}
        {tab === 'canvases' && (
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Canvas-larım</h2>
              <button
                onClick={() => { setCanvasTitle(''); setCanvasModal(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Plus size={15} />
                Yeni Canvas
              </button>
            </div>

            {canvases.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Layout size={28} className="text-gray-300" />
                </div>
                <p className="font-medium text-gray-500">Hələ canvas yoxdur</p>
                <p className="text-sm mt-1">Yeni canvas yaradıb qeydlər aparmağa başlayın</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {canvases.map((canvas) => (
                  <div key={canvas.id}
                    className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:border-gray-300 hover:shadow-sm transition-all group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
                          <Layout size={18} className="text-violet-500" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-medium text-gray-900 truncate text-sm">{canvas.title}</h3>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <Calendar size={11} />
                            {formatDate(canvas.updated_at)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCanvas(canvas.id)}
                        className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <button
                      onClick={() => window.location.href = `/editor/${canvas.id}`}
                      className="mt-auto w-full flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 text-gray-700 text-sm py-2.5 rounded-xl transition-all font-medium"
                    >
                      Aç
                      <ChevronRight size={14} />
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
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Canvas adı</label>
            <input
              type="text"
              value={canvasTitle}
              onChange={(e) => setCanvasTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateCanvas()}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-gray-50"
              placeholder="Canvas adını daxil edin"
              autoFocus
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setCanvasModal(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Ləğv et
            </button>
            <button
              onClick={handleCreateCanvas}
              disabled={!canvasTitle.trim() || canvasLoading}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {canvasLoading && <Loader2 size={14} className="animate-spin" />}
              Yarat
            </button>
          </div>
        </div>
      </Modal>

      {/* Book Upload Modal */}
      <Modal open={bookModal} title="Kitab əlavə et" onClose={() => setBookModal(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kitab adı</label>
            <input
              type="text"
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-gray-50"
              placeholder="Kitabın adı"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Müəllif <span className="text-gray-400 font-normal">(istəyə bağlı)</span>
            </label>
            <input
              type="text"
              value={bookAuthor}
              onChange={(e) => setBookAuthor(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-gray-50"
              placeholder="Müəllifin adı"
            />
          </div>
          {bookFile && (
            <p className="text-xs text-gray-400 bg-gray-50 px-3 py-2 rounded-lg">
              📄 {bookFile.name} — {formatSize(bookFile.size)}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setBookModal(false)}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Ləğv et
            </button>
            <button
              onClick={handleBookUpload}
              disabled={!bookTitle.trim() || uploading}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {uploading && <Loader2 size={14} className="animate-spin" />}
              {uploading ? 'Yüklənir...' : 'Yüklə'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
