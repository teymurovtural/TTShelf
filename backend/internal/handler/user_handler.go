package handler

import (
	"net/http"

	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/internal/middleware"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type UserHandler struct {
	userService domain.UserService
}

func NewUserHandler(userService domain.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// GetMe godoc
// @Summary      Get current user
// @Tags         users
// @Produce      json
// @Security     BearerAuth
// @Success      200 {object} domain.UserResponse
// @Failure      401 {object} response.Response
// @Router       /users/me [get]
func (h *UserHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	if userID == "" {
		response.Error(w, apperror.ErrTokenNotFound)
		return
	}

	user, err := h.userService.GetMe(r.Context(), userID)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	response.OK(w, user)
}
