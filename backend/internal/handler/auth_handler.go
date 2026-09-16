package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/teymurovtural/ttshelf-backend/internal/config"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type AuthHandler struct {
	authService domain.AuthService
	jwtCfg      *config.JWTConfig
	serverCfg   *config.ServerConfig
}

func NewAuthHandler(authService domain.AuthService, jwtCfg *config.JWTConfig, serverCfg *config.ServerConfig) *AuthHandler {
	return &AuthHandler{authService: authService, jwtCfg: jwtCfg, serverCfg: serverCfg}
}

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
	response.Created(w, resp)
}

func (h *AuthHandler) VerifyOTP(w http.ResponseWriter, r *http.Request) {
	var req domain.VerifyOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}
	resp, err := h.authService.VerifyOTP(r.Context(), &req)
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

func (h *AuthHandler) ResendOTP(w http.ResponseWriter, r *http.Request) {
	var req domain.ResendOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Error(w, apperror.ErrInvalidRequestBody)
		return
	}
	if err := h.authService.ResendOTP(r.Context(), req.Email); err != nil {
		if appErr, ok := err.(*apperror.AppError); ok {
			response.Error(w, appErr)
			return
		}
		response.Error(w, apperror.ErrInternalError)
		return
	}
	response.OK(w, map[string]string{"message": "Yeni kod göndərildi"})
}

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

func (h *AuthHandler) setRefreshTokenCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    token,
		HttpOnly: true,
		Secure:   h.serverCfg.Env == "production",
		SameSite: http.SameSiteStrictMode,
		Path:     "/api/v1/auth",
		MaxAge:   h.jwtCfg.RefreshExpiryDays * 24 * 60 * 60,
		Expires:  time.Now().Add(time.Duration(h.jwtCfg.RefreshExpiryDays) * 24 * time.Hour),
	})
}

func (h *AuthHandler) clearRefreshTokenCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		HttpOnly: true,
		Secure:   h.serverCfg.Env == "production",
		SameSite: http.SameSiteStrictMode,
		Path:     "/api/v1/auth",
		MaxAge:   -1,
		Expires:  time.Now().Add(-time.Hour),
	})
}
