package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
)

type pageRepository struct {
	db *pgxpool.Pool
}

func NewPageRepository(db *pgxpool.Pool) domain.PageRepository {
	return &pageRepository{db: db}
}

const pageSelectFields = `id, canvas_id, page_number, title, orientation, locked, created_at, updated_at`

func scanPage(row interface {
	Scan(dest ...any) error
}, p *domain.CanvasPage) error {
	return row.Scan(
		&p.ID,
		&p.CanvasID,
		&p.PageNumber,
		&p.Title,
		&p.Orientation,
		&p.Locked,
		&p.CreatedAt,
		&p.UpdatedAt,
	)
}

func (r *pageRepository) Create(ctx context.Context, canvasID string, req *domain.CreatePageRequest) (*domain.CanvasPage, error) {
	orientation := req.Orientation
	if orientation == "" {
		orientation = "portrait"
	}

	title := req.Title
	if title == "" {
		title = "Səhifə"
	}

	// page_number: mövcud max + 1
	var maxNum int
	_ = r.db.QueryRow(ctx,
		`SELECT COALESCE(MAX(page_number), 0) FROM canvas_pages WHERE canvas_id = $1`,
		canvasID,
	).Scan(&maxNum)

	query := `
		INSERT INTO canvas_pages (canvas_id, page_number, title, orientation)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + pageSelectFields

	p := &domain.CanvasPage{}
	if err := scanPage(r.db.QueryRow(ctx, query, canvasID, maxNum+1, title, orientation), p); err != nil {
		return nil, fmt.Errorf("page create: %w", err)
	}
	return p, nil
}

func (r *pageRepository) GetByCanvasID(ctx context.Context, canvasID, userID string) ([]*domain.CanvasPage, error) {
	// canvas ownership yoxla
	var exists bool
	if err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM canvases WHERE id = $1 AND user_id = $2)`,
		canvasID, userID,
	).Scan(&exists); err != nil || !exists {
		return nil, fmt.Errorf("canvas not found")
	}

	rows, err := r.db.Query(ctx,
		`SELECT `+pageSelectFields+` FROM canvas_pages WHERE canvas_id = $1 ORDER BY page_number ASC`,
		canvasID,
	)
	if err != nil {
		return nil, fmt.Errorf("page list: %w", err)
	}
	defer rows.Close()

	var pages []*domain.CanvasPage
	for rows.Next() {
		p := &domain.CanvasPage{}
		if err := scanPage(rows, p); err != nil {
			return nil, fmt.Errorf("page scan: %w", err)
		}
		pages = append(pages, p)
	}
	return pages, nil
}

func (r *pageRepository) GetByID(ctx context.Context, id, canvasID string) (*domain.CanvasPage, error) {
	p := &domain.CanvasPage{}
	if err := scanPage(r.db.QueryRow(ctx,
		`SELECT `+pageSelectFields+` FROM canvas_pages WHERE id = $1 AND canvas_id = $2`,
		id, canvasID,
	), p); err != nil {
		return nil, fmt.Errorf("page not found: %w", err)
	}
	return p, nil
}

func (r *pageRepository) Update(ctx context.Context, id, canvasID string, req *domain.UpdatePageRequest) (*domain.CanvasPage, error) {
	// yalnız göndərilən sahələri yenilə
	query := `UPDATE canvas_pages SET updated_at = NOW()`
	args := []any{}
	argIdx := 1

	if req.Title != nil {
		query += fmt.Sprintf(`, title = $%d`, argIdx)
		args = append(args, *req.Title)
		argIdx++
	}
	if req.Orientation != nil {
		query += fmt.Sprintf(`, orientation = $%d`, argIdx)
		args = append(args, *req.Orientation)
		argIdx++
	}
	if req.Locked != nil {
		query += fmt.Sprintf(`, locked = $%d`, argIdx)
		args = append(args, *req.Locked)
		argIdx++
	}

	query += fmt.Sprintf(` WHERE id = $%d AND canvas_id = $%d RETURNING `+pageSelectFields, argIdx, argIdx+1)
	args = append(args, id, canvasID)

	p := &domain.CanvasPage{}
	if err := scanPage(r.db.QueryRow(ctx, query, args...), p); err != nil {
		return nil, fmt.Errorf("page update: %w", err)
	}
	return p, nil
}

func (r *pageRepository) Delete(ctx context.Context, id, canvasID string) error {
	result, err := r.db.Exec(ctx,
		`DELETE FROM canvas_pages WHERE id = $1 AND canvas_id = $2`,
		id, canvasID,
	)
	if err != nil {
		return fmt.Errorf("page delete: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("page not found")
	}
	return nil
}

func (r *pageRepository) CountByCanvasID(ctx context.Context, canvasID string) (int, error) {
	var count int
	if err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM canvas_pages WHERE canvas_id = $1`,
		canvasID,
	).Scan(&count); err != nil {
		return 0, fmt.Errorf("page count: %w", err)
	}
	return count, nil
}

func (r *pageRepository) ReorderPages(ctx context.Context, canvasID string, pageIDs []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("reorder begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for i, pageID := range pageIDs {
		if _, err := tx.Exec(ctx,
			`UPDATE canvas_pages SET page_number = $1, updated_at = NOW() WHERE id = $2 AND canvas_id = $3`,
			i+1, pageID, canvasID,
		); err != nil {
			return fmt.Errorf("reorder update page %s: %w", pageID, err)
		}
	}

	return tx.Commit(ctx)
}
