import { useEffect, useState } from 'react'
import { BookOpen, Layout, Plus, Trash2, LogOut } from 'lucide-react'
import { booksApi } from '../api/books'
import { canvasApi } from '../api/canvas'
import { authApi } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useBookStore } from '../store/bookStore'
import type { Canvas } from '../types'

export default function Dashboard() {
  const { logout } = useAuthStore()
  const { books, setBooks, removeBook } = useBookStore()
  const [canvases, setCanvases] = useState<Canvas[]>([])
  const [tab, setTab] = useState<'books' | 'canvases'>('books')
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    booksApi.getAll().then((res) => setBooks(res.data.data.books || []))
    canvasApi.getAll().then((res) => setCanvases(res.data.data.canvases || []))
  }, [])

  const handleLogout = async () => {
    await authApi.logout()
    logout()
    window.location.href = '/login'
  }

  const handleBookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const title = prompt('Kitabın adı:') || file.name.replace('.pdf', '')
    const author = prompt('Müəllif (boş buraxmaq olar):') || ''
    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    if (author) formData.append('author', author)
    setUploading(true)
    try {
      const res = await booksApi.upload(formData)
      setBooks([...books, res.data.data])
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Yükləmə xətası')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteBook = async (id: string) => {
    if (!confirm('Kitabı silmək istəyirsiniz?')) return
    await booksApi.delete(id)
    removeBook(id)
  }

  const handleCreateCanvas = async () => {
    const title = prompt('Canvas adı:') || 'Adsız Canvas'
    const res = await canvasApi.create({ title })
    window.location.href = `/editor/${res.data.data.id}`
  }

  const handleOpenBook = async (bookId: string, bookTitle: string) => {
    try {
      const res = await canvasApi.create({ title: bookTitle, book_id: bookId })
      window.location.href = `/editor/${res.data.data.id}?book=${bookId}`
    } catch {
      alert('Canvas yaradila bilmedi')
    }
  }

  const handleDeleteCanvas = async (id: string) => {
    if (!confirm('Canvas-ı silmək istəyirsiniz?')) return
    await canvasApi.delete(id)
    setCanvases(canvases.filter((c) => c.id !== id))
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">TTShelf</h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <LogOut size={16} />
          Çıxış
        </button>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('books')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'books' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <BookOpen size={16} />
            Kitablar ({books.length})
          </button>
          <button
            onClick={() => setTab('canvases')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'canvases' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Layout size={16} />
            Canvas-lar ({canvases.length})
          </button>
        </div>

        {/* Books tab */}
        {tab === 'books' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Kitablarım</h2>
              <label className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Plus size={16} />
                {uploading ? 'Yüklənir...' : 'PDF əlavə et'}
                <input type="file" accept=".pdf" className="hidden" onChange={handleBookUpload} />
              </label>
            </div>

            {books.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
                <p>Hələ kitab yoxdur</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {books.map((book) => (
                  <div key={book.id} className="bg-gray-900 rounded-xl p-5 flex flex-col gap-3 group">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{book.title}</h3>
                        {book.author && <p className="text-sm text-gray-400 truncate">{book.author}</p>}
                      </div>
                      <button
                        onClick={() => handleDeleteBook(book.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors ml-2 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      {book.total_pages} səhifə • {(book.file_size / 1024 / 1024).toFixed(1)} MB
                    </div>
                    {book.last_page > 1 && (
                      <div className="text-xs text-blue-400">
                        Son oxunan: {book.last_page}-ci səhifə
                      </div>
                    )}
                    <button
                      onClick={() => handleOpenBook(book.id, book.title)}
                      className="mt-auto w-full bg-gray-800 hover:bg-gray-700 text-sm py-2 rounded-lg transition-colors"
                    >
                      Oxu / Qeyd apar
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Canvas-larım</h2>
              <button
                onClick={handleCreateCanvas}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                Yeni Canvas
              </button>
            </div>

            {canvases.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Layout size={48} className="mx-auto mb-4 opacity-30" />
                <p>Hələ canvas yoxdur</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {canvases.map((canvas) => (
                  <div key={canvas.id} className="bg-gray-900 rounded-xl p-5 flex flex-col gap-3 group">
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium truncate flex-1">{canvas.title}</h3>
                      <button
                        onClick={() => handleDeleteCanvas(canvas.id)}
                        className="text-gray-600 hover:text-red-400 transition-colors ml-2 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(canvas.updated_at).toLocaleDateString('az-AZ')}
                    </div>
                    <button
                      onClick={() => window.location.href = `/editor/${canvas.id}`}
                      className="mt-auto w-full bg-gray-800 hover:bg-gray-700 text-sm py-2 rounded-lg transition-colors"
                    >
                      Aç
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
