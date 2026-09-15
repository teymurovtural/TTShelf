package repository

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
)

type canvasRepository struct {
	db *pgxpool.Pool
}

func NewCanvasRepository(db *pgxpool.Pool) domain.CanvasRepository {
	return &canvasRepository{db: db}
}

// scanCanvas — bütün Scan çağırışları üçün ortaq helper
func scanCanvas(row interface {
	Scan(dest ...any) error
}, canvas *domain.Canvas) error {
	return row.Scan(
		&canvas.ID,
		&canvas.UserID,
		&canvas.BookID,
		&canvas.Title,
		&canvas.ThumbnailKey,
		&canvas.ExportKey,
		&canvas.CreatedAt,
		&canvas.UpdatedAt,
	)
}

const canvasSelectFields = `id, user_id, book_id, title, thumbnail_key, export_key, created_at, updated_at`

func (r *canvasRepository) Create(ctx context.Context, userID string, req *domain.CreateCanvasRequest) (*domain.Canvas, error) {
	query := `
		INSERT INTO canvases (user_id, book_id, title)
		VALUES ($1, $2, $3)
		RETURNING ` + canvasSelectFields

	title := req.Title
	if title == "" {
		title = "Adsız Canvas"
	}

	canvas := &domain.Canvas{}
	if err := scanCanvas(r.db.QueryRow(ctx, query, userID, req.BookID, title), canvas); err != nil {
		return nil, fmt.Errorf("failed to create canvas: %w", err)
	}

	return canvas, nil
}

func (r *canvasRepository) GetByID(ctx context.Context, id, userID string) (*domain.Canvas, error) {
	query := `SELECT ` + canvasSelectFields + ` FROM canvases WHERE id = $1 AND user_id = $2`

	canvas := &domain.Canvas{}
	if err := scanCanvas(r.db.QueryRow(ctx, query, id, userID), canvas); err != nil {
		return nil, fmt.Errorf("failed to get canvas: %w", err)
	}

	return canvas, nil
}

func (r *canvasRepository) GetAllByUserID(ctx context.Context, userID string, limit, offset int) ([]*domain.Canvas, int, error) {
	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM canvases WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count canvases: %w", err)
	}

	query := `SELECT ` + canvasSelectFields + `
		FROM canvases
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := r.db.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to get canvases: %w", err)
	}
	defer rows.Close()

	var canvases []*domain.Canvas
	for rows.Next() {
		canvas := &domain.Canvas{}
		if err := scanCanvas(rows, canvas); err != nil {
			return nil, 0, fmt.Errorf("failed to scan canvas: %w", err)
		}
		canvases = append(canvases, canvas)
	}

	return canvases, total, nil
}

func (r *canvasRepository) UpdateTitle(ctx context.Context, id, userID, title string) (*domain.Canvas, error) {
	query := `
		UPDATE canvases SET title = $1, updated_at = NOW()
		WHERE id = $2 AND user_id = $3
		RETURNING ` + canvasSelectFields

	canvas := &domain.Canvas{}
	if err := scanCanvas(r.db.QueryRow(ctx, query, title, id, userID), canvas); err != nil {
		return nil, fmt.Errorf("failed to update canvas: %w", err)
	}

	return canvas, nil
}

func (r *canvasRepository) Delete(ctx context.Context, id, userID string) error {
	result, err := r.db.Exec(ctx, `DELETE FROM canvases WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return fmt.Errorf("failed to delete canvas: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("canvas not found")
	}
	return nil
}

func (r *canvasRepository) SaveExportKey(ctx context.Context, id, userID, exportKey string) error {
	query := `UPDATE canvases SET export_key = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3`
	result, err := r.db.Exec(ctx, query, exportKey, id, userID)
	if err != nil {
		return fmt.Errorf("failed to save export key: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("canvas not found")
	}
	return nil
}

// --- Elements ---

func (r *canvasRepository) CreateElement(ctx context.Context, canvasID string, req *domain.CreateElementRequest) (*domain.CanvasElement, error) {
	query := `
		INSERT INTO canvas_elements (canvas_id, type, data, z_index)
		VALUES ($1, $2, $3, $4)
		RETURNING id, canvas_id, type, data, z_index, created_at, updated_at
	`

	el := &domain.CanvasElement{}
	err := r.db.QueryRow(ctx, query, canvasID, req.Type, req.Data, req.ZIndex).Scan(
		&el.ID, &el.CanvasID, &el.Type, &el.Data, &el.ZIndex, &el.CreatedAt, &el.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create element: %w", err)
	}

	return el, nil
}

func (r *canvasRepository) GetElements(ctx context.Context, canvasID, userID string) ([]*domain.CanvasElement, error) {
	var exists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM canvases WHERE id = $1 AND user_id = $2)`, canvasID, userID).Scan(&exists); err != nil || !exists {
		return nil, fmt.Errorf("canvas not found")
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, canvas_id, type, data, z_index, created_at, updated_at
		FROM canvas_elements WHERE canvas_id = $1 ORDER BY z_index ASC`, canvasID)
	if err != nil {
		return nil, fmt.Errorf("failed to get elements: %w", err)
	}
	defer rows.Close()

	var elements []*domain.CanvasElement
	for rows.Next() {
		el := &domain.CanvasElement{}
		if err := rows.Scan(&el.ID, &el.CanvasID, &el.Type, &el.Data, &el.ZIndex, &el.CreatedAt, &el.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan element: %w", err)
		}
		elements = append(elements, el)
	}

	return elements, nil
}

func (r *canvasRepository) UpdateElement(ctx context.Context, id, canvasID string, req *domain.UpdateElementRequest) (*domain.CanvasElement, error) {
	query := `
		UPDATE canvas_elements SET data = $1, z_index = $2, updated_at = NOW()
		WHERE id = $3 AND canvas_id = $4
		RETURNING id, canvas_id, type, data, z_index, created_at, updated_at
	`

	el := &domain.CanvasElement{}
	err := r.db.QueryRow(ctx, query, req.Data, req.ZIndex, id, canvasID).Scan(
		&el.ID, &el.CanvasID, &el.Type, &el.Data, &el.ZIndex, &el.CreatedAt, &el.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update element: %w", err)
	}

	return el, nil
}

func (r *canvasRepository) DeleteElement(ctx context.Context, id, canvasID string) error {
	result, err := r.db.Exec(ctx, `DELETE FROM canvas_elements WHERE id = $1 AND canvas_id = $2`, id, canvasID)
	if err != nil {
		return fmt.Errorf("failed to delete element: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("element not found")
	}
	return nil
}

func (r *canvasRepository) BatchSaveElements(ctx context.Context, canvasID, userID string, elements []*domain.BatchElement) error {
	var exists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM canvases WHERE id = $1 AND user_id = $2)`, canvasID, userID).Scan(&exists); err != nil || !exists {
		return fmt.Errorf("canvas not found")
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM canvas_elements WHERE canvas_id = $1`, canvasID); err != nil {
		return fmt.Errorf("failed to delete old elements: %w", err)
	}

	for _, el := range elements {
		data, err := json.Marshal(el.Data)
		if err != nil {
			return fmt.Errorf("failed to marshal element data: %w", err)
		}
		if _, err = tx.Exec(ctx,
			`INSERT INTO canvas_elements (canvas_id, type, data, z_index) VALUES ($1, $2, $3, $4)`,
			canvasID, el.Type, data, el.ZIndex,
		); err != nil {
			return fmt.Errorf("failed to insert element: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE canvases SET updated_at = NOW() WHERE id = $1`, canvasID); err != nil {
		return fmt.Errorf("failed to update canvas: %w", err)
	}

	return tx.Commit(ctx)
}
