package handler

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/teymurovtural/ttshelf-backend/internal/storage"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

const (
	maxImageSize = 10 << 20 // 10MB
	maxFontSize  = 5 << 20  // 5MB
)

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

var allowedFontTypes = map[string]string{
	"font/ttf":               ".ttf",
	"font/otf":               ".otf",
	"font/woff":              ".woff",
	"font/woff2":             ".woff2",
	"application/font-woff":  ".woff",
	"application/x-font-ttf": ".ttf",
}

type UploadHandler struct {
	minio     *storage.MinioClient
	publicURL string
}

func NewUploadHandler(minio *storage.MinioClient, publicURL string) *UploadHandler {
	return &UploadHandler{
		minio:     minio,
		publicURL: strings.TrimRight(publicURL, "/"),
	}
}

type UploadResponse struct {
	URL string `json:"url"`
	Key string `json:"key"`
}

// UploadImage godoc
// @Summary      Upload image for canvas
// @Tags         upload
// @Accept       multipart/form-data
// @Produce      json
// @Security     BearerAuth
// @Param        file formData file true "Image file (PNG/JPG/WEBP, max 10MB)"
// @Success      200 {object} handler.UploadResponse
// @Failure      400 {object} response.Response
// @Router       /upload/image [post]
func (h *UploadHandler) UploadImage(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxImageSize); err != nil {
		response.Error(w, apperror.New("FILE_TOO_LARGE", "Şəkil maksimum 10MB ola bilər", http.StatusBadRequest))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.New("FILE_REQUIRED", "Şəkil fayl tələb olunur", http.StatusBadRequest))
		return
	}
	defer file.Close()

	// MIME type yoxla (ilk 512 byte oxu)
	buf := make([]byte, 512)
	n, err := file.Read(buf)
	if err != nil {
		response.Error(w, apperror.ErrInternalError)
		return
	}
	mimeType := http.DetectContentType(buf[:n])

	ext, ok := allowedImageTypes[mimeType]
	if !ok {
		// DetectContentType bəzən "image/jpeg" əvəzinə başqa şey qaytarır,
		// header Content-Type-a da bax
		ct := header.Header.Get("Content-Type")
		ext, ok = allowedImageTypes[ct]
		if !ok {
			response.Error(w, apperror.New("INVALID_FILE_TYPE", "Yalnız PNG, JPG və WEBP qəbul edilir", http.StatusBadRequest))
			return
		}
		mimeType = ct
	}

	// Faylı başa qaytar (ilk 512 byte artıq oxundu)
	if _, err := file.Seek(0, 0); err != nil {
		response.Error(w, apperror.ErrInternalError)
		return
	}

	objectKey := fmt.Sprintf("images/%s%s", uuid.New().String(), ext)

	if err := h.minio.Upload(r.Context(), objectKey, mimeType, file, header.Size); err != nil {
		response.Error(w, apperror.ErrInternalError)
		return
	}

	url := fmt.Sprintf("%s/%s/%s", h.publicURL, h.minio.BucketName(), objectKey)

	response.OK(w, UploadResponse{
		URL: url,
		Key: objectKey,
	})
}

// UploadFont godoc
// @Summary      Upload custom font (only file, no DB record)
// @Tags         upload
// @Accept       multipart/form-data
// @Produce      json
// @Security     BearerAuth
// @Param        file formData file true "Font file (TTF/OTF/WOFF/WOFF2, max 5MB)"
// @Success      200 {object} handler.UploadResponse
// @Failure      400 {object} response.Response
// @Router       /upload/font [post]
func (h *UploadHandler) UploadFont(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(maxFontSize); err != nil {
		response.Error(w, apperror.New("FILE_TOO_LARGE", "Font faylı maksimum 5MB ola bilər", http.StatusBadRequest))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.New("FILE_REQUIRED", "Font fayl tələb olunur", http.StatusBadRequest))
		return
	}
	defer file.Close()

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

	objectKey, err := uploadFontToMinio(r, h.minio, file, header.Size, originalExt, mimeType)
	if err != nil {
		response.Error(w, apperror.ErrInternalError)
		return
	}

	url := fmt.Sprintf("%s/%s/%s", h.publicURL, h.minio.BucketName(), objectKey)

	response.OK(w, UploadResponse{
		URL: url,
		Key: objectKey,
	})
}

// uploadFontToMinio — font_handler.go ilə ortaq helper
func uploadFontToMinio(r *http.Request, minioClient *storage.MinioClient, file interface {
	Read([]byte) (int, error)
	Seek(int64, int) (int64, error)
}, size int64, ext, mimeType string) (string, error) {
	objectKey := fmt.Sprintf("fonts/%s%s", uuid.New().String(), ext)
	if err := minioClient.Upload(r.Context(), objectKey, mimeType, file, size); err != nil {
		return "", err
	}
	return objectKey, nil
}
