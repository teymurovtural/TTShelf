const DB_NAME    = 'ttshelf-pdf-cache'
const STORE_NAME = 'pdfs'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)
        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME)
            }
        }
        req.onsuccess = () => resolve(req.result)
        req.onerror   = () => reject(req.error)
    })
}

export async function getCachedPdf(bookId: string): Promise<ArrayBuffer | null> {
    try {
        const db = await openDB()
        return new Promise((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, 'readonly')
            const req = tx.objectStore(STORE_NAME).get(bookId)
            req.onsuccess = () => resolve(req.result ?? null)
            req.onerror   = () => reject(req.error)
        })
    } catch {
        return null
    }
}

export async function setCachedPdf(bookId: string, buffer: ArrayBuffer): Promise<void> {
    try {
        const db = await openDB()
        await new Promise<void>((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, 'readwrite')
            const req = tx.objectStore(STORE_NAME).put(buffer, bookId)
            req.onsuccess = () => resolve()
            req.onerror   = () => reject(req.error)
        })
    } catch {}
}

export async function clearCachedPdf(bookId: string): Promise<void> {
    try {
        const db = await openDB()
        await new Promise<void>((resolve, reject) => {
            const tx  = db.transaction(STORE_NAME, 'readwrite')
            const req = tx.objectStore(STORE_NAME).delete(bookId)
            req.onsuccess = () => resolve()
            req.onerror   = () => reject(req.error)
        })
    } catch {}
}