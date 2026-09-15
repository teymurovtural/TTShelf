package handler

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/internal/middleware"
	"github.com/teymurovtural/ttshelf-backend/internal/storage"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type FontHandler struct {
	fontService domain.FontService
	minio       *storage.MinioClient
}

func NewFontHandler(fontService domain.FontService, minio *storage.MinioClient) *FontHandler {
	return &FontHandler{
		fontService: fontService,
		minio:       minio,
	}
}

// Upload godoc
// @Summary      Upload and register a font
// @Tags         fonts
// @Accept       multipart/form-data
// @Produce      json
// @Security     BearerAuth
// @Param        file formData file   true "Font file (TTF/OTF/WOFF/WOFF2, max 5MB)"
// @Param        name formData string true "Font display name"
// @Success      201 {object} domain.Font
// @Failure      400 {object} response.Response
// @Router       /fonts [post]
func (h *FontHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	if err := r.ParseMultipartForm(maxFontSize); err != nil {
		response.Error(w, apperror.New("FILE_TOO_LARGE", "Font faylı maksimum 5MB ola bilər", http.StatusBadRequest))
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		response.Error(w, apperror.New("INVALID_FONT_NAME", "Font adı tələb olunur", http.StatusBadRequest))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.New("FILE_REQUIRED", "Font fayl tələb olunur", http.StatusBadRequest))
		return
	}
	defer file.Close()

	// Extension yoxla
	originalExt := strings.ToLower(filepath.Ext(header.Filename))
	mimeType := ""
	for mt, ext := range allowedFontTypes {
		if ext == originalExt {
			mimeType = mt
			break
		}
	}
	if mimeType == "" {
		response.Error(w, apperror.New("INVALID_FILE_TYPE", "Yalnız TTF, OTF, WOFF və WOFF2 qəbul edilir", http.StatusBadRequest))
		return
	}

	// MinIO-ya yüklə
	objectKey, err := uploadFontToMinio(r, h.minio, file, header.Size, originalExt, mimeType)
	if err != nil {
		response.Error(w, apperror.ErrInternalError)
		return
	}

	// DB-yə qeyd et
	font, err := h.fontService.Create(r.Context(), userID, name, objectKey)
	if err != nil {
		// MinIO-ya artıq yükləndi, amma DB xətası — MinIO-dan sil
		_ = h.minio.Delete(r.Context(), objectKey)
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.Created(w, font)
}

// GetAll godoc
// @Summary      Get user fonts
// @Tags         fonts
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} []domain.Font
// @Router       /fonts [get]
func (h *FontHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	fonts, err := h.fontService.GetAll(r.Context(), userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	if fonts == nil {
		fonts = []*domain.Font{}
	}

	response.OK(w, fonts)
}

// Delete godoc
// @Summary      Delete a font
// @Tags         fonts
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Font ID"
// @Success      200 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /fonts/{id} [delete]
func (h *FontHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	font, err := h.fontService.Delete(r.Context(), id, userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	// MinIO-dan da sil
	_ = h.minio.Delete(r.Context(), font.FileKey)

	response.OK(w, map[string]string{"message": "Font silindi"})
}
