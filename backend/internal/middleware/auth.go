package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
)

type contextKey string

const UserIDKey contextKey = "user_id"
const UserEmailKey contextKey = "user_email"

type jwtClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func Auth(accessSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 1. Authorization header
			tokenStr := ""
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
					tokenStr = authHeader[7:]
				} else {
					tokenStr = authHeader
				}
			}

			// 2. ?token= query param (iframe üçün)
			if tokenStr == "" {
				tokenStr = r.URL.Query().Get("token")
			}

			if tokenStr == "" {
				response.Error(w, apperror.ErrTokenNotFound)
				return
			}

			token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, apperror.ErrInvalidToken
				}
				return []byte(accessSecret), nil
			})
			if err != nil || !token.Valid {
				response.Error(w, apperror.ErrInvalidToken)
				return
			}

			claims, ok := token.Claims.(*jwtClaims)
			if !ok {
				response.Error(w, apperror.ErrInvalidToken)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(r *http.Request) string {
	if id, ok := r.Context().Value(UserIDKey).(string); ok {
		return id
	}
	return ""
}

func GetUserEmail(r *http.Request) string {
	if email, ok := r.Context().Value(UserEmailKey).(string); ok {
		return email
	}
	return ""
}
