package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
)

type fontService struct {
	fontRepo  domain.FontRepository
	publicURL string
	bucket    string
}

func NewFontService(fontRepo domain.FontRepository, publicURL, bucket string) domain.FontService {
	return &fontService{
		fontRepo:  fontRepo,
		publicURL: strings.TrimRight(publicURL, "/"),
		bucket:    bucket,
	}
}

func (s *fontService) buildURL(fileKey string) string {
	return fmt.Sprintf("%s/%s/%s", s.publicURL, s.bucket, fileKey)
}

func (s *fontService) Create(ctx context.Context, userID, name, fileKey string) (*domain.Font, error) {
	if strings.TrimSpace(name) == "" {
		return nil, apperror.New("INVALID_FONT_NAME", "Font adı boş ola bilməz", 400)
	}

	font, err := s.fontRepo.Create(ctx, userID, name, fileKey)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	font.URL = s.buildURL(font.FileKey)
	return font, nil
}

func (s *fontService) GetAll(ctx context.Context, userID string) ([]*domain.Font, error) {
	fonts, err := s.fontRepo.GetAllByUserID(ctx, userID)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	for _, f := range fonts {
		f.URL = s.buildURL(f.FileKey)
	}

	return fonts, nil
}

func (s *fontService) Delete(ctx context.Context, id, userID string) (*domain.Font, error) {
	// Əvvəlcə font-u tap — MinIO key lazımdır
	font, err := s.fontRepo.GetByID(ctx, id, userID)
	if err != nil {
		return nil, apperror.New("FONT_NOT_FOUND", "Font tapılmadı", 404)
	}

	if err := s.fontRepo.Delete(ctx, id, userID); err != nil {
		return nil, apperror.New("FONT_NOT_FOUND", "Font tapılmadı", 404)
	}

	return font, nil
}
