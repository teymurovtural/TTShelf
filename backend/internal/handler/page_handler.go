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

type PageHandler struct {
	pageSvc   domain.PageService
	canvasSvc domain.CanvasService
}

func NewPageHandler(pageSvc domain.PageService, canvasSvc domain.CanvasService) *PageHandler {
	return &PageHandler{pageSvc: pageSvc, canvasSvc: canvasSvc}
}

func (h *PageHandler) GetPages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")

	pages, err := h.pageSvc.GetPages(r.Context(), canvasID, userID)
	if err != nil {
		response.Error(w, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404))
		return
	}

	response.OK(w, pages)
}

func (h *PageHandler) CreatePage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")

	var req domain.CreatePageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	page, err := h.pageSvc.CreatePage(r.Context(), canvasID, userID, &req)
	if err != nil {
		response.Error(w, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404))
		return
	}

	response.Created(w, page)
}

func (h *PageHandler) UpdatePage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")
	pageID := chi.URLParam(r, "pid")

	var req domain.UpdatePageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	page, err := h.pageSvc.UpdatePage(r.Context(), pageID, canvasID, userID, &req)
	if err != nil {
		response.Error(w, apperror.New("PAGE_NOT_FOUND", "Səhifə tapılmadı", 404))
		return
	}

	response.OK(w, page)
}

func (h *PageHandler) DeletePage(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")
	pageID := chi.URLParam(r, "pid")

	if err := h.pageSvc.DeletePage(r.Context(), pageID, canvasID, userID); err != nil {
		if err.Error() == "cannot delete the last page" {
			response.Error(w, apperror.New("LAST_PAGE", "Son səhifəni silmək olmaz", 400))
			return
		}
		response.Error(w, apperror.New("PAGE_NOT_FOUND", "Səhifə tapılmadı", 404))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PageHandler) ReorderPages(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")

	var req domain.ReorderPagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	if err := h.pageSvc.ReorderPages(r.Context(), canvasID, userID, &req); err != nil {
		response.Error(w, apperror.New("REORDER_FAILED", err.Error(), 400))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *PageHandler) GetPageElements(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")
	pageID := chi.URLParam(r, "pid")

	elements, err := h.canvasSvc.GetElementsByPageID(r.Context(), pageID, canvasID, userID)
	if err != nil {
		response.Error(w, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404))
		return
	}

	response.OK(w, elements)
}

func (h *PageHandler) BatchSavePageElements(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	canvasID := chi.URLParam(r, "id")
	pageID := chi.URLParam(r, "pid")

	var req domain.BatchSaveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	if err := h.canvasSvc.BatchSaveElementsByPageID(r.Context(), pageID, canvasID, userID, &req); err != nil {
		response.Error(w, apperror.New("CANVAS_NOT_FOUND", "Canvas tapılmadı", 404))
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
