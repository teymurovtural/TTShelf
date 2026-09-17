// ---- Auth ----
export interface User {
    id: string
    email: string
    username: string
    name: string
    created_at: string
}

export interface AuthResponse {
    user: User
    access_token: string
}

// ---- Book ----
export interface Book {
    id: string
    user_id: string
    title: string
    author?: string
    file_key: string
    file_size: number
    last_page: number
    total_pages: number
    created_at: string
}

export interface BooksListResponse {
    books: Book[]
    total: number
    limit: number
    offset: number
}

// ---- Annotation ----
export interface Annotation {
    id: string
    book_id: string
    user_id: string
    page_number: number
    x: number
    y: number
    width: number
    height: number
    color: string
    note?: string
    created_at: string
}

// ---- Canvas ----
export interface Canvas {
    id: string
    user_id: string
    book_id?: string
    title: string
    export_url?: string
    created_at: string
    updated_at: string
}

export interface CanvasListResponse {
    canvases: Canvas[]
    total: number
    limit: number
    offset: number
}

// ---- Canvas Elements ----
export type ElementType =
    | 'rect'
    | 'circle'
    | 'arrow'
    | 'text'
    | 'image'
    | 'line'
    | 'freehand'
    | 'triangle'
    | 'star'
    | 'pentagon'
    | 'hexagon'
    | 'diamond'
    | 'parallelogram'
    | 'cylinder'
    | 'cross'

export interface ElementData {
    x?: number
    y?: number
    width?: number
    height?: number
    fill?: string
    stroke?: string
    strokeWidth?: number
    text?: string
    fontSize?: number
    fontFamily?: string
    rotation?: number
    points?: number[]
    src?: string        // image üçün MinIO URL
    scaleX?: number
    scaleY?: number
    opacity?: number
    dash?: number[]
    lineCap?: string
    lineJoin?: string
    sides?: number
    innerRadius?: number
    cornerRadius?: number | number[]
}

export interface CanvasElement {
    id: string
    canvas_id: string
    type: ElementType
    data: ElementData
    z_index: number
    created_at: string
    updated_at: string
}

export interface BatchElement {
    id?: string
    type: ElementType
    data: ElementData
    z_index: number
}

// ---- Font ----
export interface Font {
    id: string
    user_id: string
    name: string
    url: string
    created_at: string
}

// ---- Upload ----
export interface UploadResponse {
    url: string
    key: string
}

export interface ExportPDFResponse {
    url: string
    key: string
}

// ---- API Response ----
export interface ApiResponse<T> {
    success: boolean
    data?: T
    error?: {
        code: string
        message: string
    }
}