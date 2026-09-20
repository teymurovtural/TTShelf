package domain

import (
	"context"
	"encoding/json"
	"time"
)

type Canvas struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	BookID       *string   `json:"book_id,omitempty"`
	Title        string    `json:"title"`
	ThumbnailKey *string   `json:"-"`
	ExportKey    *string   `json:"-"`
	ExportURL    *string   `json:"export_url,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type CanvasElement struct {
	ID        string          `json:"id"`
	CanvasID  string          `json:"canvas_id"`
	PageID    *string         `json:"page_id,omitempty"`
	Type      string          `json:"type"`
	Data      json.RawMessage `json:"data" swaggertype:"object"`
	ZIndex    int             `json:"z_index"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// Repository interface
type CanvasRepository interface {
	Create(ctx context.Context, userID string, req *CreateCanvasRequest) (*Canvas, error)
	GetByID(ctx context.Context, id, userID string) (*Canvas, error)
	GetAllByUserID(ctx context.Context, userID string, limit, offset int) ([]*Canvas, int, error)
	UpdateTitle(ctx context.Context, id, userID, title string) (*Canvas, error)
	Delete(ctx context.Context, id, userID string) error
	SaveExportKey(ctx context.Context, id, userID, exportKey string) error

	// Element metodları — canvas-level (backwards compat)
	CreateElement(ctx context.Context, canvasID string, req *CreateElementRequest) (*CanvasElement, error)
	GetElements(ctx context.Context, canvasID, userID string) ([]*CanvasElement, error)
	UpdateElement(ctx context.Context, id, canvasID string, req *UpdateElementRequest) (*CanvasElement, error)
	DeleteElement(ctx context.Context, id, canvasID string) error
	BatchSaveElements(ctx context.Context, canvasID, userID string, elements []*BatchElement) error

	// Element metodları — page-level (yeni)
	GetElementsByPageID(ctx context.Context, pageID, canvasID, userID string) ([]*CanvasElement, error)
	BatchSaveElementsByPageID(ctx context.Context, pageID, canvasID, userID string, elements []*BatchElement) error
}

// Service interface
type CanvasService interface {
	Create(ctx context.Context, userID string, req *CreateCanvasRequest) (*Canvas, error)
	GetByID(ctx context.Context, id, userID string) (*Canvas, error)
	GetAll(ctx context.Context, userID string, limit, offset int) ([]*Canvas, int, error)
	UpdateTitle(ctx context.Context, id, userID string, req *UpdateCanvasTitleRequest) (*Canvas, error)
	Delete(ctx context.Context, id, userID string) error
	ExportPDF(ctx context.Context, canvasID, userID string, pdfData []byte) (string, error)

	// Element metodları — canvas-level (backwards compat)
	CreateElement(ctx context.Context, canvasID, userID string, req *CreateElementRequest) (*CanvasElement, error)
	GetElements(ctx context.Context, canvasID, userID string) ([]*CanvasElement, error)
	UpdateElement(ctx context.Context, id, canvasID, userID string, req *UpdateElementRequest) (*CanvasElement, error)
	DeleteElement(ctx context.Context, id, canvasID, userID string) error
	BatchSaveElements(ctx context.Context, canvasID, userID string, req *BatchSaveRequest) error

	// Element metodları — page-level (yeni)
	GetElementsByPageID(ctx context.Context, pageID, canvasID, userID string) ([]*CanvasElement, error)
	BatchSaveElementsByPageID(ctx context.Context, pageID, canvasID, userID string, req *BatchSaveRequest) error
}

// --- Request modelleri ---

type CreateCanvasRequest struct {
	Title  string  `json:"title"`
	BookID *string `json:"book_id,omitempty"`
}

type UpdateCanvasTitleRequest struct {
	Title string `json:"title"`
}

type ElementData = json.RawMessage

type CreateElementRequest struct {
	PageID *string     `json:"page_id,omitempty"`
	Type   string      `json:"type"`
	Data   ElementData `json:"data" swaggertype:"object"`
	ZIndex int         `json:"z_index"`
}

type UpdateElementRequest struct {
	Data   ElementData `json:"data" swaggertype:"object"`
	ZIndex int         `json:"z_index"`
}

type BatchElement struct {
	ID     *string     `json:"id,omitempty"`
	PageID *string     `json:"page_id,omitempty"`
	Type   string      `json:"type"`
	Data   ElementData `json:"data" swaggertype:"object"`
	ZIndex int         `json:"z_index"`
}

type BatchSaveRequest struct {
	Elements []*BatchElement `json:"elements"`
}

// --- Response modelleri ---

type CanvasListResponse struct {
	Canvases []*Canvas `json:"canvases"`
	Total    int       `json:"total"`
	Limit    int       `json:"limit"`
	Offset   int       `json:"offset"`
}

type ExportPDFResponse struct {
	URL string `json:"url"`
	Key string `json:"key"`
}
