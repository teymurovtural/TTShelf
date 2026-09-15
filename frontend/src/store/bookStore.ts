import { create } from 'zustand'
import type { Book } from '../types'

interface BookState {
    books: Book[]
    currentBook: Book | null
    currentPage: number

    setBooks: (books: Book[]) => void
    setCurrentBook: (book: Book | null) => void
    setCurrentPage: (page: number) => void
    updateBook: (id: string, data: Partial<Book>) => void
    removeBook: (id: string) => void
}

export const useBookStore = create<BookState>((set) => ({
    books: [],
    currentBook: null,
    currentPage: 1,

    setBooks: (books) => set({ books }),

    setCurrentBook: (book) => set({
        currentBook: book,
        currentPage: book?.last_page || 1,
    }),

    setCurrentPage: (page) => set({ currentPage: page }),

    updateBook: (id, data) => set((state) => ({
        books: state.books.map((b) => b.id === id ? { ...b, ...data } : b),
        currentBook: state.currentBook?.id === id
            ? { ...state.currentBook, ...data }
            : state.currentBook,
    })),

    removeBook: (id) => set((state) => ({
        books: state.books.filter((b) => b.id !== id),
        currentBook: state.currentBook?.id === id ? null : state.currentBook,
    })),
}))