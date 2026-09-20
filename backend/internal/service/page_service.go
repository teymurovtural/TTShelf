package service

import (
	"context"
	"fmt"

	"github.com/teymurovtural/ttshelf-backend/internal/domain"
)

type pageService struct {
	pageRepo   domain.PageRepository
	canvasRepo domain.CanvasRepository
}

func NewPageService(pageRepo domain.PageRepository, canvasRepo domain.CanvasRepository) domain.PageService {
	return &pageService{
		pageRepo:   pageRepo,
		canvasRepo: canvasRepo,
	}
}

func (s *pageService) CreatePage(ctx context.Context, canvasID, userID string, req *domain.CreatePageRequest) (*domain.CanvasPage, error) {
	// canvas ownership yoxla
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return nil, fmt.Errorf("canvas not found")
	}
	return s.pageRepo.Create(ctx, canvasID, req)
}

func (s *pageService) GetPages(ctx context.Context, canvasID, userID string) ([]*domain.CanvasPage, error) {
	return s.pageRepo.GetByCanvasID(ctx, canvasID, userID)
}

func (s *pageService) GetPageByID(ctx context.Context, id, canvasID, userID string) (*domain.CanvasPage, error) {
	// canvas ownership yoxla
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return nil, fmt.Errorf("canvas not found")
	}
	return s.pageRepo.GetByID(ctx, id, canvasID)
}

func (s *pageService) UpdatePage(ctx context.Context, id, canvasID, userID string, req *domain.UpdatePageRequest) (*domain.CanvasPage, error) {
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return nil, fmt.Errorf("canvas not found")
	}
	return s.pageRepo.Update(ctx, id, canvasID, req)
}

func (s *pageService) DeletePage(ctx context.Context, id, canvasID, userID string) error {
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return fmt.Errorf("canvas not found")
	}

	// Son page silinə bilməz
	count, err := s.pageRepo.CountByCanvasID(ctx, canvasID)
	if err != nil {
		return err
	}
	if count <= 1 {
		return fmt.Errorf("cannot delete the last page")
	}

	return s.pageRepo.Delete(ctx, id, canvasID)
}

func (s *pageService) ReorderPages(ctx context.Context, canvasID, userID string, req *domain.ReorderPagesRequest) error {
	if _, err := s.canvasRepo.GetByID(ctx, canvasID, userID); err != nil {
		return fmt.Errorf("canvas not found")
	}
	if len(req.PageIDs) == 0 {
		return fmt.Errorf("page_ids cannot be empty")
	}
	return s.pageRepo.ReorderPages(ctx, canvasID, req.PageIDs)
}
