package service

import (
	"context"

	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
)

type annotationService struct {
	annotationRepo domain.AnnotationRepository
	bookRepo       domain.BookRepository
}

func NewAnnotationService(annotationRepo domain.AnnotationRepository, bookRepo domain.BookRepository) domain.AnnotationService {
	return &annotationService{
		annotationRepo: annotationRepo,
		bookRepo:       bookRepo,
	}
}

func (s *annotationService) Create(ctx context.Context, userID, bookID string, req *domain.CreateAnnotationRequest) (*domain.Annotation, error) {
	// Kitab user-ə məxsusdurmu yoxla
	if _, err := s.bookRepo.GetByID(ctx, bookID, userID); err != nil {
		return nil, apperror.New("BOOK_NOT_FOUND", "Kitab tapılmadı", 404)
	}

	if req.PageNumber < 1 {
		return nil, apperror.New("INVALID_PAGE", "Səhifə nömrəsi düzgün deyil", 400)
	}

	if req.Width <= 0 || req.Height <= 0 {
		return nil, apperror.New("INVALID_DIMENSIONS", "Annotation ölçüləri düzgün deyil", 400)
	}

	annotation, err := s.annotationRepo.Create(ctx, userID, bookID, req)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	return annotation, nil
}

func (s *annotationService) GetByBookID(ctx context.Context, bookID, userID string) ([]*domain.Annotation, error) {
	// Kitab user-ə məxsusdurmu yoxla
	if _, err := s.bookRepo.GetByID(ctx, bookID, userID); err != nil {
		return nil, apperror.New("BOOK_NOT_FOUND", "Kitab tapılmadı", 404)
	}

	annotations, err := s.annotationRepo.GetByBookID(ctx, bookID, userID)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	return annotations, nil
}

func (s *annotationService) Update(ctx context.Context, id, userID string, req *domain.UpdateAnnotationRequest) (*domain.Annotation, error) {
	annotation, err := s.annotationRepo.Update(ctx, id, userID, req)
	if err != nil {
		return nil, apperror.New("ANNOTATION_NOT_FOUND", "Annotation tapılmadı", 404)
	}

	return annotation, nil
}

func (s *annotationService) Delete(ctx context.Context, id, userID string) error {
	if err := s.annotationRepo.Delete(ctx, id, userID); err != nil {
		return apperror.New("ANNOTATION_NOT_FOUND", "Annotation tapılmadı", 404)
	}

	return nil
}
