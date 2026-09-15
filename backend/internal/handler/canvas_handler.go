package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/internal/middleware"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type CanvasHandler struct {
	canvasService domain.CanvasService
}

func NewCanvasHandler(canvasService domain.CanvasService) *CanvasHandler {
	return &CanvasHandler{canvasService: canvasService}
}

// Create godoc
// @Summary      Create new canvas
// @Tags         canvases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        request body domain.CreateCanvasRequest true "Create canvas request"
// @Success      201 {object} domain.Canvas
// @Failure      400 {object} response.Response
// @Router       /canvases [post]
func (h *CanvasHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req domain.CreateCanvasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	canvas, err := h.canvasService.Create(r.Context(), userID, &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.Created(w, canvas)
}

// GetAll godoc
// @Summary      Get all canvases
// @Tags         canvases
// @Produce      json
// @Security     BearerAuth
// @Param        limit  query int false "Limit (default 20)"
// @Param        offset query int false "Offset (default 0)"
// @Success      200 {object} domain.CanvasListResponse
// @Router       /canvases [get]
func (h *CanvasHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	canvases, total, err := h.canvasService.GetAll(r.Context(), userID, limit, offset)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, domain.CanvasListResponse{
		Canvases: canvases,
		Total:    total,
		Limit:    limit,
		Offset:   offset,
	})
}

// GetByID godoc
// @Summary      Get canvas by ID
// @Tags         canvases
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Canvas ID"
// @Success      200 {object} domain.Canvas
// @Failure      404 {object} response.Response
// @Router       /canvases/{id} [get]
func (h *CanvasHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	canvas, err := h.canvasService.GetByID(r.Context(), id, userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, canvas)
}

// UpdateTitle godoc
// @Summary      Update canvas title
// @Tags         canvases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path string                       true "Canvas ID"
// @Param        request body domain.UpdateCanvasTitleRequest true "Update title request"
// @Success      200 {object} domain.Canvas
// @Failure      404 {object} response.Response
// @Router       /canvases/{id} [put]
func (h *CanvasHandler) UpdateTitle(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	var req domain.UpdateCanvasTitleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	canvas, err := h.canvasService.UpdateTitle(r.Context(), id, userID, &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, canvas)
}

// Delete godoc
// @Summary      Delete canvas
// @Tags         canvases
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Canvas ID"
// @Success      200 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /canvases/{id} [delete]
func (h *CanvasHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	if err := h.canvasService.Delete(r.Context(), id, userID); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, map[string]string{"message": "Canvas silindi"})
}

// CreateElement godoc
// @Summary      Create canvas element
// @Tags         canvases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path string                     true "Canvas ID"
// @Param        request body domain.CreateElementRequest true "Element data"
// @Success      201 {object} domain.CanvasElement
// @Failure      404 {object} response.Response
// @Router       /canvases/{id}/elements [post]
func (h *CanvasHandler) CreateElement(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")

	var req domain.CreateElementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	el, err := h.canvasService.CreateElement(r.Context(), canvasID, userID, &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.Created(w, el)
}

// GetElements godoc
// @Summary      Get canvas elements
// @Tags         canvases
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Canvas ID"
// @Success      200 {object} []domain.CanvasElement
// @Failure      404 {object} response.Response
// @Router       /canvases/{id}/elements [get]
func (h *CanvasHandler) GetElements(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")

	elements, err := h.canvasService.GetElements(r.Context(), canvasID, userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, elements)
}

// UpdateElement godoc
// @Summary      Update canvas element
// @Tags         canvases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id  path string                     true "Canvas ID"
// @Param        eid path string                     true "Element ID"
// @Param        request body domain.UpdateElementRequest true "Element data"
// @Success      200 {object} domain.CanvasElement
// @Failure      404 {object} response.Response
// @Router       /canvases/{id}/elements/{eid} [put]
func (h *CanvasHandler) UpdateElement(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")
	elementID := chi.URLParam(r, "eid")

	var req domain.UpdateElementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	el, err := h.canvasService.UpdateElement(r.Context(), elementID, canvasID, userID, &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, el)
}

// DeleteElement godoc
// @Summary      Delete canvas element
// @Tags         canvases
// @Produce      json
// @Security     BearerAuth
// @Param        id  path string true "Canvas ID"
// @Param        eid path string true "Element ID"
// @Success      200 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /canvases/{id}/elements/{eid} [delete]
func (h *CanvasHandler) DeleteElement(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")
	elementID := chi.URLParam(r, "eid")

	if err := h.canvasService.DeleteElement(r.Context(), elementID, canvasID, userID); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, map[string]string{"message": "Element silindi"})
}

// BatchSaveElements godoc
// @Summary      Batch save canvas elements (auto-save)
// @Tags         canvases
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path string                  true "Canvas ID"
// @Param        request body domain.BatchSaveRequest true "Batch elements"
// @Success      200 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /canvases/{id}/elements/batch [post]
func (h *CanvasHandler) BatchSaveElements(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")

	var req domain.BatchSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	if err := h.canvasService.BatchSaveElements(r.Context(), canvasID, userID, &req); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, map[string]string{"message": "Elementlər saxlanıldı"})
}
