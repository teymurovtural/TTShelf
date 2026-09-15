package handler

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/internal/middleware"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type BookHandler struct {
	bookService domain.BookService
}

func NewBookHandler(bookService domain.BookService) *BookHandler {
	return &BookHandler{bookService: bookService}
}

// Upload godoc
// @Summary      Upload a book (PDF)
// @Tags         books
// @Accept       multipart/form-data
// @Produce      json
// @Security     BearerAuth
// @Param        title   formData string true  "Book title"
// @Param        author  formData string false "Book author"
// @Param        file    formData file   true  "PDF file"
// @Success      201 {object} domain.Book
// @Failure      400 {object} response.Response
// @Router       /books [post]
func (h *BookHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	if err := r.ParseMultipartForm(100 << 20); err != nil {
		response.Error(w, apperror.New("INVALID_FORM", "Form datasını oxumaq mümkün olmadı", http.StatusBadRequest))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, apperror.New("FILE_REQUIRED", "PDF fayl tələb olunur", http.StatusBadRequest))
		return
	}
	defer file.Close()

	req := &domain.BookUploadRequest{
		Title:  r.FormValue("title"),
		Author: r.FormValue("author"),
	}

	book, err := h.bookService.UploadFile(r.Context(), userID, req, file, header)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.Created(w, book)
}

// GetAll godoc
// @Summary      Get all books
// @Tags         books
// @Produce      json
// @Security     BearerAuth
// @Param        limit  query int false "Limit (default 20)"
// @Param        offset query int false "Offset (default 0)"
// @Success      200 {object} domain.BooksListResponse
// @Failure      401 {object} response.Response
// @Router       /books [get]
func (h *BookHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	books, total, err := h.bookService.GetAll(r.Context(), userID, limit, offset)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, domain.BooksListResponse{
		Books:  books,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	})
}

// GetByID godoc
// @Summary      Get book by ID
// @Tags         books
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Book ID"
// @Success      200 {object} domain.Book
// @Failure      404 {object} response.Response
// @Router       /books/{id} [get]
func (h *BookHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	book, err := h.bookService.GetByID(r.Context(), id, userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, book)
}

// StreamFile godoc
// @Summary      Stream PDF file
// @Tags         books
// @Produce      application/pdf
// @Security     BearerAuth
// @Param        id path string true "Book ID"
// @Success      200
// @Failure      404 {object} response.Response
// @Router       /books/{id}/file [get]
func (h *BookHandler) StreamFile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	reader, size, err := h.bookService.StreamFile(r.Context(), id, userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}
	defer reader.Close()

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Accept-Ranges", "bytes")

	io.Copy(w, reader)
}

// UpdateBookmark godoc
// @Summary      Update bookmark (last page)
// @Tags         books
// @Accept       json
// @Produce      json
// @Security     BearerAuth
// @Param        id      path string                true "Book ID"
// @Param        request body domain.BookmarkRequest true "Bookmark request"
// @Success      200 {object} response.Response
// @Failure      400 {object} response.Response
// @Router       /books/{id}/bookmark [put]
func (h *BookHandler) UpdateBookmark(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	var req domain.BookmarkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	if err := h.bookService.UpdateBookmark(r.Context(), id, userID, &req); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, map[string]string{"message": "Bookmark yeniləndi"})
}

// Delete godoc
// @Summary      Delete book
// @Tags         books
// @Produce      json
// @Security     BearerAuth
// @Param        id path string true "Book ID"
// @Success      200 {object} response.Response
// @Failure      404 {object} response.Response
// @Router       /books/{id} [delete]
func (h *BookHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	id := chi.URLParam(r, "id")

	if err := h.bookService.Delete(r.Context(), id, userID); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, map[string]string{"message": "Kitab silindi"})
}
