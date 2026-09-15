package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
)

type annotationRepository struct {
	db *pgxpool.Pool
}

func NewAnnotationRepository(db *pgxpool.Pool) domain.AnnotationRepository {
	return &annotationRepository{db: db}
}

func (r *annotationRepository) Create(ctx context.Context, userID, bookID string, req *domain.CreateAnnotationRequest) (*domain.Annotation, error) {
	query := `
		INSERT INTO book_annotations (book_id, user_id, page_number, x, y, width, height, color, note)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, book_id, user_id, page_number, x, y, width, height, color, note, created_at
	`

	color := req.Color
	if color == "" {
		color = "#FFFF00"
	}

	a := &domain.Annotation{}
	err := r.db.QueryRow(ctx, query,
		bookID, userID, req.PageNumber,
		req.X, req.Y, req.Width, req.Height,
		color, req.Note,
	).Scan(
		&a.ID, &a.BookID, &a.UserID,
		&a.PageNumber, &a.X, &a.Y, &a.Width, &a.Height,
		&a.Color, &a.Note, &a.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create annotation: %w", err)
	}

	return a, nil
}

func (r *annotationRepository) GetByBookID(ctx context.Context, bookID, userID string) ([]*domain.Annotation, error) {
	query := `
		SELECT id, book_id, user_id, page_number, x, y, width, height, color, note, created_at
		FROM book_annotations
		WHERE book_id = $1 AND user_id = $2
		ORDER BY page_number ASC, created_at ASC
	`

	rows, err := r.db.Query(ctx, query, bookID, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get annotations: %w", err)
	}
	defer rows.Close()

	var annotations []*domain.Annotation
	for rows.Next() {
		a := &domain.Annotation{}
		if err := rows.Scan(
			&a.ID, &a.BookID, &a.UserID,
			&a.PageNumber, &a.X, &a.Y, &a.Width, &a.Height,
			&a.Color, &a.Note, &a.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan annotation: %w", err)
		}
		annotations = append(annotations, a)
	}

	return annotations, nil
}

func (r *annotationRepository) Update(ctx context.Context, id, userID string, req *domain.UpdateAnnotationRequest) (*domain.Annotation, error) {
	query := `
		UPDATE book_annotations
		SET color = $1, note = $2
		WHERE id = $3 AND user_id = $4
		RETURNING id, book_id, user_id, page_number, x, y, width, height, color, note, created_at
	`

	a := &domain.Annotation{}
	err := r.db.QueryRow(ctx, query, req.Color, req.Note, id, userID).Scan(
		&a.ID, &a.BookID, &a.UserID,
		&a.PageNumber, &a.X, &a.Y, &a.Width, &a.Height,
		&a.Color, &a.Note, &a.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update annotation: %w", err)
	}

	return a, nil
}

func (r *annotationRepository) Delete(ctx context.Context, id, userID string) error {
	query := `DELETE FROM book_annotations WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete annotation: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("annotation not found")
	}
	return nil
}
