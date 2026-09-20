package service

import (
	"context"

	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
)

type canvasService struct {
	canvasRepo domain.CanvasRepository
}

func NewCanvasService(canvasRepo domain.CanvasRepository) domain.CanvasService {
	return &canvasService{canvasRepo: canvasRepo}
}

func (s *canvasService) Create(ctx context.Context, userID string, req *domain.CreateCanvasRequest) (*domain.Canvas, error) {
	canvas, err := s.canvasRepo.Create(ctx, userID, req)
	if err != nil {
		return nil, apperror.ErrInternalError
	}
	return canvas, nil
}

func (s *canvasService) GetByID(ctx context.Context, id, userID string) (*domain.Canvas, error) {
	canvas, err := s.canvasRepo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}
	return canvas, nil
}

func (s *canvasService) GetAll(ctx context.Context, userID string, limit, offset int) ([]*domain.Canvas, int, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	canvases, total, err := s.canvasRepo.GetAllByUserID(ctx, userID, limit, offset)
	if err != nil {
		return nil, 0, apperror.ErrInternalError
	}

	return canvases, total, nil
}

func (s *canvasService) UpdateTitle(ctx context.Context, id, userID string, req *domain.UpdateCanvasTitleRequest) (*domain.Canvas, error) {
	if req.Title == "" {
		return nil, apperror.New("INVALID_TITLE", "Canvas adı boş ola bilməz", 400)
	}

	canvas, err := s.canvasRepo.UpdateTitle(ctx, id, userID, req.Title)
	if err != nil {
		return nil, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}

	return canvas, nil
}

func (s *canvasService) Delete(ctx context.Context, id, userID string) error {
	if err := s.canvasRepo.Delete(ctx, id, userID); err != nil {
		return apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}
	return nil
}

func (s *canvasService) CreateElement(ctx context.Context, canvasID, userID string, req *domain.CreateElementRequest) (*domain.CanvasElement, error) {
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return nil, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}

	el, err := s.canvasRepo.CreateElement(ctx, canvasID, req)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	return el, nil
}

func (s *canvasService) GetElements(ctx context.Context, canvasID, userID string) ([]*domain.CanvasElement, error) {
	elements, err := s.canvasRepo.GetElements(ctx, canvasID, userID)
	if err != nil {
		return nil, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}
	return elements, nil
}

func (s *canvasService) UpdateElement(ctx context.Context, id, canvasID, userID string, req *domain.UpdateElementRequest) (*domain.CanvasElement, error) {
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return nil, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}

	el, err := s.canvasRepo.UpdateElement(ctx, id, canvasID, req)
	if err != nil {
		return nil, apperror.New("ELEMENT_NOT_FOUND", "Element tapılmadı", 404)
	}

	return el, nil
}

func (s *canvasService) DeleteElement(ctx context.Context, id, canvasID, userID string) error {
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}

	if err := s.canvasRepo.DeleteElement(ctx, id, canvasID); err != nil {
		return apperror.New("ELEMENT_NOT_FOUND", "Element tapılmadı", 404)
	}

	return nil
}

func (s *canvasService) BatchSaveElements(ctx context.Context, canvasID, userID string, req *domain.BatchSaveRequest) error {
	if err := s.canvasRepo.BatchSaveElements(ctx, canvasID, userID, req.Elements); err != nil {
		return apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}
	return nil
}

// GetElementsByPageID — yeni page-level elements
func (s *canvasService) GetElementsByPageID(ctx context.Context, pageID, canvasID, userID string) ([]*domain.CanvasElement, error) {
	elements, err := s.canvasRepo.GetElementsByPageID(ctx, pageID, canvasID, userID)
	if err != nil {
		return nil, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}
	return elements, nil
}

// BatchSaveElementsByPageID — yeni page-level batch save (auto-save üçün)
func (s *canvasService) BatchSaveElementsByPageID(ctx context.Context, pageID, canvasID, userID string, req *domain.BatchSaveRequest) error {
	if err := s.canvasRepo.BatchSaveElementsByPageID(ctx, pageID, canvasID, userID, req.Elements); err != nil {
		return apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}
	return nil
}

func (s *canvasService) ExportPDF(ctx context.Context, canvasID, userID string, pdfData []byte) (string, error) {
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return "", apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404)
	}

	return canvasID, nil // handler MinIO-ya yükləyəcək
}
