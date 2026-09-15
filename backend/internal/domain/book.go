package domain

import (
	"context"
	"io"
	"mime/multipart"
	"time"
)

type Book struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Title      string    `json:"title"`
	Author     string    `json:"author"`
	FileKey    string    `json:"-"`
	FileSize   int64     `json:"file_size"`
	LastPage   int       `json:"last_page"`
	TotalPages int       `json:"total_pages"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type BookRepository interface {
	Create(ctx context.Context, userID, title, author, fileKey string, fileSize int64) (*Book, error)
	GetByID(ctx context.Context, id, userID string) (*Book, error)
	GetAllByUserID(ctx context.Context, userID string, limit, offset int) ([]*Book, int, error)
	UpdateBookmark(ctx context.Context, id, userID string, lastPage int) error
	UpdateTotalPages(ctx context.Context, id, userID string, totalPages int) error
	Delete(ctx context.Context, id, userID string) (*Book, error)
}

type BookService interface {
	UploadFile(ctx context.Context, userID string, req *BookUploadRequest, file multipart.File, header *multipart.FileHeader) (*Book, error)
	GetByID(ctx context.Context, id, userID string) (*Book, error)
	GetAll(ctx context.Context, userID string, limit, offset int) ([]*Book, int, error)
	UpdateBookmark(ctx context.Context, id, userID string, req *BookmarkRequest) error
	Delete(ctx context.Context, id, userID string) error
	GetFileKey(ctx context.Context, id, userID string) (string, error)
	StreamFile(ctx context.Context, id, userID string) (io.ReadCloser, int64, error)
}

type BookUploadRequest struct {
	Title  string `json:"title"`
	Author string `json:"author"`
}

type BookmarkRequest struct {
	LastPage int `json:"last_page"`
}

type BooksListResponse struct {
	Books  []*Book `json:"books"`
	Total  int     `json:"total"`
	Limit  int     `json:"limit"`
	Offset int     `json:"offset"`
}
