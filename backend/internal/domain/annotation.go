package domain

import (
	"context"
	"time"
)

type Annotation struct {
	ID         string    `json:"id"`
	BookID     string    `json:"book_id"`
	UserID     string    `json:"user_id"`
	PageNumber int       `json:"page_number"`
	X          float64   `json:"x"`
	Y          float64   `json:"y"`
	Width      float64   `json:"width"`
	Height     float64   `json:"height"`
	Color      string    `json:"color"`
	Note       string    `json:"note"`
	CreatedAt  time.Time `json:"created_at"`
}

type AnnotationRepository interface {
	Create(ctx context.Context, userID, bookID string, req *CreateAnnotationRequest) (*Annotation, error)
	GetByBookID(ctx context.Context, bookID, userID string) ([]*Annotation, error)
	Update(ctx context.Context, id, userID string, req *UpdateAnnotationRequest) (*Annotation, error)
	Delete(ctx context.Context, id, userID string) error
}

type AnnotationService interface {
	Create(ctx context.Context, userID, bookID string, req *CreateAnnotationRequest) (*Annotation, error)
	GetByBookID(ctx context.Context, bookID, userID string) ([]*Annotation, error)
	Update(ctx context.Context, id, userID string, req *UpdateAnnotationRequest) (*Annotation, error)
	Delete(ctx context.Context, id, userID string) error
}

type CreateAnnotationRequest struct {
	PageNumber int     `json:"page_number"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	Color      string  `json:"color"`
	Note       string  `json:"note"`
}

type UpdateAnnotationRequest struct {
	Color string `json:"color"`
	Note  string `json:"note"`
}
