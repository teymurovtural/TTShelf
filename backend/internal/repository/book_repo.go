package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
)

type bookRepository struct {
	db *pgxpool.Pool
}

func NewBookRepository(db *pgxpool.Pool) domain.BookRepository {
	return &bookRepository{db: db}
}

func (r *bookRepository) Create(ctx context.Context, userID, title, author, fileKey string, fileSize int64) (*domain.Book, error) {
	query := `
		INSERT INTO books (user_id, title, author, file_key, file_size)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, user_id, title, author, file_key, file_size, last_page, total_pages, created_at, updated_at
	`

	book := &domain.Book{}
	err := r.db.QueryRow(ctx, query, userID, title, author, fileKey, fileSize).Scan(
		&book.ID,
		&book.UserID,
		&book.Title,
		&book.Author,
		&book.FileKey,
		&book.FileSize,
		&book.LastPage,
		&book.TotalPages,
		&book.CreatedAt,
		&book.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create book: %w", err)
	}

	return book, nil
}

func (r *bookRepository) GetByID(ctx context.Context, id, userID string) (*domain.Book, error) {
	query := `
		SELECT id, user_id, title, author, file_key, file_size, last_page, total_pages, created_at, updated_at
		FROM books
		WHERE id = $1 AND user_id = $2
	`

	book := &domain.Book{}
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&book.ID,
		&book.UserID,
		&book.Title,
		&book.Author,
		&book.FileKey,
		&book.FileSize,
		&book.LastPage,
		&book.TotalPages,
		&book.CreatedAt,
		&book.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get book: %w", err)
	}

	return book, nil
}

func (r *bookRepository) GetAllByUserID(ctx context.Context, userID string, limit, offset int) ([]*domain.Book, int, error) {
	countQuery := `SELECT COUNT(*) FROM books WHERE user_id = $1`
	var total int
	if err := r.db.QueryRow(ctx, countQuery, userID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count books: %w", err)
	}

	query := `
		SELECT id, user_id, title, author, file_key, file_size, last_page, total_pages, created_at, updated_at
		FROM books
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`

	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get books: %w", err)
	}
	defer rows.Close()

	var books []*domain.Book
	for rows.Next() {
		book := &domain.Book{}
		if err := rows.Scan(
			&book.ID,
			&book.UserID,
			&book.Title,
			&book.Author,
			&book.FileKey,
			&book.FileSize,
			&book.LastPage,
			&book.TotalPages,
			&book.CreatedAt,
			&book.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan book: %w", err)
		}
		books = append(books, book)
	}

	return books, total, nil
}

func (r *bookRepository) UpdateBookmark(ctx context.Context, id, userID string, lastPage int) error {
	query := `
		UPDATE books SET last_page = $1, updated_at = NOW()
		WHERE id = $2 AND user_id = $3
	`

	result, err := r.db.Exec(ctx, query, lastPage, id, userID)
	if err != nil {
		return fmt.Errorf("failed to update bookmark: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("book not found")
	}

	return nil
}

func (r *bookRepository) UpdateTotalPages(ctx context.Context, id, userID string, totalPages int) error {
	query := `
		UPDATE books SET total_pages = $1, updated_at = NOW()
		WHERE id = $2 AND user_id = $3
	`

	_, err := r.db.Exec(ctx, query, totalPages, id, userID)
	if err != nil {
		return fmt.Errorf("failed to update total pages: %w", err)
	}

	return nil
}

func (r *bookRepository) Delete(ctx context.Context, id, userID string) (*domain.Book, error) {
	query := `
		DELETE FROM books
		WHERE id = $1 AND user_id = $2
		RETURNING id, user_id, title, author, file_key, file_size, last_page, total_pages, created_at, updated_at
	`

	book := &domain.Book{}
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&book.ID,
		&book.UserID,
		&book.Title,
		&book.Author,
		&book.FileKey,
		&book.FileSize,
		&book.LastPage,
		&book.TotalPages,
		&book.CreatedAt,
		&book.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to delete book: %w", err)
	}

	return book, nil
}
