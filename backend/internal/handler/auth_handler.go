package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/teymurovtural/ttshelf-backend/internal/config"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type AuthHandler struct {
	authService domain.AuthService
	validate    *validator.Validate
	jwtCfg      *config.JWTConfig
	serverCfg   *config.ServerConfig
}

func NewAuthHandler(authService domain.AuthService, jwtCfg *config.JWTConfig, serverCfg *config.ServerConfig) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		validate:    validator.New(),
		jwtCfg:      jwtCfg,
		serverCfg:   serverCfg,
	}
}

// Register godoc
// @Summary      Register new user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body domain.RegisterRequest true "Register request"
// @Success      201 {object} domain.AuthResponse
// @Failure      400 {object} response.Response
// @Failure      409 {object} response.Response
// @Router       /auth/register [post]
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req domain.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	resp, err := h.authService.Register(r.Context(), &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	h.setRefreshTokenCookie(w, resp.RefreshToken)
	response.Created(w, resp)
}

// Login godoc
// @Summary      Login user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        request body domain.LoginRequest true "Login request"
// @Success      200 {object} domain.AuthResponse
// @Failure      400 {object} response.Response
// @Failure      401 {object} response.Response
// @Router       /auth/login [post]
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req domain.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}

	resp, err := h.authService.Login(r.Context(), &req)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	h.setRefreshTokenCookie(w, resp.RefreshToken)
	response.OK(w, resp)
}

// Refresh godoc
// @Summary      Refresh access token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Success      200 {object} domain.AuthResponse
// @Failure      401 {object} response.Response
// @Router       /auth/refresh [post]
func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		response.Error(w, apperror.ErrTokenNotFound)
		return
	}

	resp, err := h.authService.Refresh(r.Context(), cookie.Value)
	if err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	h.setRefreshTokenCookie(w, resp.RefreshToken)
	response.OK(w, resp)
}

// Logout godoc
// @Summary      Logout user
// @Tags         auth
// @Accept       json
// @Produce      json
// @Success      200 {object} response.Response
// @Failure      401 {object} response.Response
// @Router       /auth/logout [delete]
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("refresh_token")
	if err != nil {
		response.Error(w, apperror.ErrTokenNotFound)
		return
	}

	if err := h.authService.Logout(r.Context(), cookie.Value); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}

	h.clearRefreshTokenCookie(w)
	response.OK(w, map[string]string{"message": "Uğurla çıxış edildi"})
}

// --- helpers ---

func (h *AuthHandler) setRefreshTokenCookie(w http.ResponseWriter, token string) {
	secure := h.serverCfg.Env == "production"

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
		Path:     "/api/v1/auth",
		MaxAge:   h.jwtCfg.RefreshExpiryDays * 24 * 60 * 60,
		Expires:  time.Now().Add(time.Duration(h.jwtCfg.RefreshExpiryDays) * 24 * time.Hour),
	})
}

func (h *AuthHandler) clearRefreshTokenCookie(w http.ResponseWriter) {
	secure := h.serverCfg.Env == "production"

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteStrictMode,
		Path:     "/api/v1/auth",
		MaxAge:   -1,
		Expires:  time.Now().Add(-time.Hour),
	})
}
