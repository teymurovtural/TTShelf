package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/internal/storage"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
)

type bookService struct {
	bookRepo domain.BookRepository
	minio    *storage.MinioClient
}

func NewBookService(bookRepo domain.BookRepository, minio *storage.MinioClient) domain.BookService {
	return &bookService{
		bookRepo: bookRepo,
		minio:    minio,
	}
}

func (s *bookService) UploadFile(ctx context.Context, userID string, req *domain.BookUploadRequest, file multipart.File, header *multipart.FileHeader) (*domain.Book, error) {
	if req.Title == "" {
		return nil, apperror.New("INVALID_TITLE", "Kitab adı boş ola bilməz", 400)
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".pdf" {
		return nil, apperror.New("INVALID_FILE_TYPE", "Yalnız PDF fayllar qəbul edilir", 400)
	}

	if header.Size > 100*1024*1024 {
		return nil, apperror.New("FILE_TOO_LARGE", "Fayl ölçüsü maksimum 100MB ola bilər", 400)
	}

	// Faylı yaddaşa oxu — həm səhifə saymaq həm upload üçün
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	// PDF səhifə sayını al
	totalPages, err := getPDFPageCount(fileBytes)
	if err != nil {
		return nil, apperror.New("INVALID_PDF", "PDF fayl oxuna bilmədi", 400)
	}

	fileKey := fmt.Sprintf("books/%s/%s.pdf", userID, uuid.New().String())

	if err := s.minio.Upload(ctx, fileKey, "application/pdf", bytes.NewReader(fileBytes), header.Size); err != nil {
		return nil, apperror.ErrInternalError
	}

	book, err := s.bookRepo.Create(ctx, userID, req.Title, req.Author, fileKey, header.Size)
	if err != nil {
		s.minio.Delete(ctx, fileKey)
		return nil, apperror.ErrInternalError
	}

	// Səhifə sayını yenilə
	if err := s.bookRepo.UpdateTotalPages(ctx, book.ID, userID, totalPages); err != nil {
		return nil, apperror.ErrInternalError
	}
	book.TotalPages = totalPages

	return book, nil
}

func (s *bookService) GetByID(ctx context.Context, id, userID string) (*domain.Book, error) {
	book, err := s.bookRepo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, apperror.New("BOOK_NOT_FOUND", "Kitab tapılmadı", 404)
	}
	return book, nil
}

func (s *bookService) GetAll(ctx context.Context, userID string, limit, offset int) ([]*domain.Book, int, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	books, total, err := s.bookRepo.GetAllByUserID(ctx, userID, limit, offset)
	if err != nil {
		return nil, 0, apperror.ErrInternalError
	}

	return books, total, nil
}

func (s *bookService) UpdateBookmark(ctx context.Context, id, userID string, req *domain.BookmarkRequest) error {
	if req.LastPage < 1 {
		return apperror.New("INVALID_PAGE", "Səhifə nömrəsi 1-dən kiçik ola bilməz", 400)
	}

	if err := s.bookRepo.UpdateBookmark(ctx, id, userID, req.LastPage); err != nil {
		return apperror.New("BOOK_NOT_FOUND", "Kitab tapılmadı", 404)
	}

	return nil
}

func (s *bookService) Delete(ctx context.Context, id, userID string) error {
	book, err := s.bookRepo.Delete(ctx, id, userID)
	if err != nil {
		return apperror.New("BOOK_NOT_FOUND", "Kitab tapılmadı", 404)
	}

	if err := s.minio.Delete(ctx, book.FileKey); err != nil {
		return apperror.ErrInternalError
	}

	return nil
}

func (s *bookService) GetFileKey(ctx context.Context, id, userID string) (string, error) {
	book, err := s.bookRepo.GetByID(ctx, id, userID)
	if err != nil {
		return "", apperror.New("BOOK_NOT_FOUND", "Kitab tapılmadı", 404)
	}
	return book.FileKey, nil
}

func (s *bookService) StreamFile(ctx context.Context, id, userID string) (io.ReadCloser, int64, error) {
	book, err := s.bookRepo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, 0, apperror.New("BOOK_NOT_FOUND", "Kitab tapılmadı", 404)
	}

	obj, err := s.minio.Download(ctx, book.FileKey)
	if err != nil {
		return nil, 0, apperror.ErrInternalError
	}

	info, err := s.minio.GetObjectInfo(ctx, book.FileKey)
	if err != nil {
		return nil, 0, apperror.ErrInternalError
	}

	return obj, info.Size, nil
}

// --- helpers ---

func getPDFPageCount(data []byte) (int, error) {
	count, err := api.PageCount(bytes.NewReader(data), nil)
	if err != nil {
		return 0, err
	}
	return count, nil
}
