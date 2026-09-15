package domain

import (
	"context"
	"time"
)

type Font struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	FileKey   string    `json:"-"`
	URL       string    `json:"url"` // MinIO public URL — DB-də saxlanılmır, runtime-da əlavə edilir
	CreatedAt time.Time `json:"created_at"`
}

// Repository interface
type FontRepository interface {
	Create(ctx context.Context, userID, name, fileKey string) (*Font, error)
	GetAllByUserID(ctx context.Context, userID string) ([]*Font, error)
	GetByID(ctx context.Context, id, userID string) (*Font, error)
	Delete(ctx context.Context, id, userID string) error
}

// Service interface
type FontService interface {
	Create(ctx context.Context, userID, name, fileKey string) (*Font, error)
	GetAll(ctx context.Context, userID string) ([]*Font, error)
	Delete(ctx context.Context, id, userID string) (*Font, error) // MinIO key-i də qaytarır
}
