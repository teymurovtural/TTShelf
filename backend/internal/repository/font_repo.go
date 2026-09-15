package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
)

type fontRepository struct {
	db *pgxpool.Pool
}

func NewFontRepository(db *pgxpool.Pool) domain.FontRepository {
	return &fontRepository{db: db}
}

func (r *fontRepository) Create(ctx context.Context, userID, name, fileKey string) (*domain.Font, error) {
	query := `
		INSERT INTO fonts (user_id, name, file_key)
		VALUES ($1, $2, $3)
		RETURNING id, user_id, name, file_key, created_at
	`

	font := &domain.Font{}
	err := r.db.QueryRow(ctx, query, userID, name, fileKey).Scan(
		&font.ID,
		&font.UserID,
		&font.Name,
		&font.FileKey,
		&font.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create font: %w", err)
	}

	return font, nil
}

func (r *fontRepository) GetAllByUserID(ctx context.Context, userID string) ([]*domain.Font, error) {
	query := `
		SELECT id, user_id, name, file_key, created_at
		FROM fonts
		WHERE user_id = $1
		ORDER BY created_at DESC
	`

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get fonts: %w", err)
	}
	defer rows.Close()

	var fonts []*domain.Font
	for rows.Next() {
		font := &domain.Font{}
		if err := rows.Scan(
			&font.ID,
			&font.UserID,
			&font.Name,
			&font.FileKey,
			&font.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan font: %w", err)
		}
		fonts = append(fonts, font)
	}

	return fonts, nil
}

func (r *fontRepository) GetByID(ctx context.Context, id, userID string) (*domain.Font, error) {
	query := `
		SELECT id, user_id, name, file_key, created_at
		FROM fonts
		WHERE id = $1 AND user_id = $2
	`

	font := &domain.Font{}
	err := r.db.QueryRow(ctx, query, id, userID).Scan(
		&font.ID,
		&font.UserID,
		&font.Name,
		&font.FileKey,
		&font.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get font: %w", err)
	}

	return font, nil
}

func (r *fontRepository) Delete(ctx context.Context, id, userID string) error {
	query := `DELETE FROM fonts WHERE id = $1 AND user_id = $2`
	result, err := r.db.Exec(ctx, query, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete font: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("font not found")
	}
	return nil
}
