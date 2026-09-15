package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/internal/middleware"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type AnnotationHandler struct {
	annotationService domain.AnnotationService
}

func NewAnnotationHandler(annotationService domain.AnnotationService) *AnnotationHandler {
	return &AnnotationHandler{annotationService: annotationService}
}

// GetByBookID godoc
// @Summary      Get annotations for a book
// @Tags         annotations
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Book ID"
// @Success      200 {object} []domain.Annotation
// @Failure      404 {object} response.Response
// @Router       /books/{id}/annotations [get]
func (h *AnnotationHandler) GetByBookID(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	bookID := chi.URLParam(r, "id")

	annotations, err := h.annotationService.GetByBookID(r.Context(), bookID, userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, annotations)
}

// Create godoc
// @Summary      Create annotation
// @Tags         annotations
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path string                        true "Book ID"
// @Param        request body domain.CreateAnnotationRequest true "Annotation data"
// @Success      201 {object} domain.Annotation
// @Failure      400 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /books/{id}/annotations [post]
func (h *AnnotationHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	bookID := chi.URLParam(r, "id")

	var req domain.CreateAnnotationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	annotation, err := h.annotationService.Create(r.Context(), userID, bookID, &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.Created(w, annotation)
}

// Update godoc
// @Summary      Update annotation
// @Tags         annotations
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id  path string                        true "Book ID"
// @Param        aid path string                        true "Annotation ID"
// @Param        request body domain.UpdateAnnotationRequest true "Update data"
// @Success      200 {object} domain.Annotation
// @Failure      404 {object} response.Response
// @Router       /books/{id}/annotations/{aid} [put]
func (h *AnnotationHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	annotationID := chi.URLParam(r, "aid")

	var req domain.UpdateAnnotationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	annotation, err := h.annotationService.Update(r.Context(), annotationID, userID, &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, annotation)
}

// Delete godoc
// @Summary      Delete annotation
// @Tags         annotations
// @Produce      json
// @Security     BearerAuth
// @Param        id  path string true "Book ID"
// @Param        aid path string true "Annotation ID"
// @Success      200 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /books/{id}/annotations/{aid} [delete]
func (h *AnnotationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	annotationID := chi.URLParam(r, "aid")

	if err := h.annotationService.Delete(r.Context(), annotationID, userID); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, map[string]string{"message": "Annotation silindi"})
}
