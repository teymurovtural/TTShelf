package domain

import (
	"context"
	"time"
)

type CanvasPage struct {
	ID          string    `json:"id"`
	CanvasID    string    `json:"canvas_id"`
	PageNumber  int       `json:"page_number"`
	Title       string    `json:"title"`
	Orientation string    `json:"orientation"` // "portrait" | "landscape"
	Locked      bool      `json:"locked"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PageRepository interface {
	Create(ctx context.Context, canvasID string, req *CreatePageRequest) (*CanvasPage, error)
	GetByCanvasID(ctx context.Context, canvasID, userID string) ([]*CanvasPage, error)
	GetByID(ctx context.Context, id, canvasID string) (*CanvasPage, error)
	Update(ctx context.Context, id, canvasID string, req *UpdatePageRequest) (*CanvasPage, error)
	Delete(ctx context.Context, id, canvasID string) error
	CountByCanvasID(ctx context.Context, canvasID string) (int, error)
	ReorderPages(ctx context.Context, canvasID string, pageIDs []string) error
}

type PageService interface {
	CreatePage(ctx context.Context, canvasID, userID string, req *CreatePageRequest) (*CanvasPage, error)
	GetPages(ctx context.Context, canvasID, userID string) ([]*CanvasPage, error)
	GetPageByID(ctx context.Context, id, canvasID, userID string) (*CanvasPage, error)
	UpdatePage(ctx context.Context, id, canvasID, userID string, req *UpdatePageRequest) (*CanvasPage, error)
	DeletePage(ctx context.Context, id, canvasID, userID string) error
	ReorderPages(ctx context.Context, canvasID, userID string, req *ReorderPagesRequest) error
}

// --- Request / Response ---

type CreatePageRequest struct {
	Title       string `json:"title"`
	Orientation string `json:"orientation"` // default: "portrait"
}

type UpdatePageRequest struct {
	Title       *string `json:"title,omitempty"`
	Orientation *string `json:"orientation,omitempty"`
	Locked      *bool   `json:"locked,omitempty"`
}

type ReorderPagesRequest struct {
	PageIDs []string `json:"page_ids"`
}
