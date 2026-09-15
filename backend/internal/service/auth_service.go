package service

import (
	"context"
	"regexp"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/teymurovtural/ttshelf-backend/internal/config"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"golang.org/x/crypto/bcrypt"
)

var (
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,50}$`)
)

type authService struct {
	userRepo domain.UserRepository
	redis    *redis.Client
	cfg      *config.JWTConfig
}

func NewAuthService(userRepo domain.UserRepository, redis *redis.Client, cfg *config.JWTConfig) domain.AuthService {
	return &authService{
		userRepo: userRepo,
		redis:    redis,
		cfg:      cfg,
	}
}

func (s *authService) Register(ctx context.Context, req *domain.RegisterRequest) (*domain.AuthResponse, error) {
	if !emailRegex.MatchString(req.Email) {
		return nil, apperror.ErrInvalidEmail
	}

	if !usernameRegex.MatchString(req.Username) {
		return nil, apperror.ErrInvalidUsername
	}

	if len(req.Name) < 2 {
		return nil, apperror.ErrNameTooShort
	}

	if len(req.Name) > 100 {
		return nil, apperror.ErrNameTooLong
	}

	if len(req.Password) < 8 {
		return nil, apperror.ErrPasswordTooShort
	}

	if len(req.Password) > 72 {
		return nil, apperror.ErrPasswordTooLong
	}

	emailExists, err := s.userRepo.EmailExists(ctx, req.Email)
	if err != nil {
		return nil, apperror.ErrInternalError
	}
	if emailExists {
		return nil, apperror.ErrEmailTaken
	}

	usernameExists, err := s.userRepo.UsernameExists(ctx, req.Username)
	if err != nil {
		return nil, apperror.ErrInternalError
	}
	if usernameExists {
		return nil, apperror.ErrUsernameTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	user, err := s.userRepo.Create(ctx, req, string(hash))
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	return s.buildAuthResponse(ctx, user)
}

func (s *authService) Login(ctx context.Context, req *domain.LoginRequest) (*domain.AuthResponse, error) {
	if !emailRegex.MatchString(req.Email) {
		return nil, apperror.ErrInvalidEmail
	}

	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, apperror.ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, apperror.ErrInvalidCredentials
	}

	return s.buildAuthResponse(ctx, user)
}

func (s *authService) Refresh(ctx context.Context, refreshToken string) (*domain.AuthResponse, error) {
	claims, err := s.parseToken(refreshToken, s.cfg.RefreshSecret)
	if err != nil {
		return nil, apperror.ErrInvalidToken
	}

	key := refreshTokenKey(claims.UserID, refreshToken)
	exists, err := s.redis.Exists(ctx, key).Result()
	if err != nil || exists == 0 {
		return nil, apperror.ErrTokenNotFound
	}

	s.redis.Del(ctx, key)

	user, err := s.userRepo.GetByID(ctx, claims.UserID)
	if err != nil {
		return nil, apperror.ErrInvalidCredentials
	}

	return s.buildAuthResponse(ctx, user)
}

func (s *authService) Logout(ctx context.Context, refreshToken string) error {
	claims, err := s.parseToken(refreshToken, s.cfg.RefreshSecret)
	if err != nil {
		return apperror.ErrInvalidToken
	}

	key := refreshTokenKey(claims.UserID, refreshToken)
	s.redis.Del(ctx, key)

	return nil
}

// --- helpers ---

type jwtClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

func (s *authService) buildAuthResponse(ctx context.Context, user *domain.User) (*domain.AuthResponse, error) {
	accessToken, err := s.generateToken(user, s.cfg.AccessSecret, time.Duration(s.cfg.AccessExpiryMinutes)*time.Minute)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	refreshToken, err := s.generateToken(user, s.cfg.RefreshSecret, time.Duration(s.cfg.RefreshExpiryDays)*24*time.Hour)
	if err != nil {
		return nil, apperror.ErrInternalError
	}

	key := refreshTokenKey(user.ID, refreshToken)
	ttl := time.Duration(s.cfg.RefreshExpiryDays) * 24 * time.Hour
	if err := s.redis.Set(ctx, key, user.ID, ttl).Err(); err != nil {
		return nil, apperror.ErrInternalError
	}

	return &domain.AuthResponse{
		User: domain.UserResponse{
			ID:        user.ID,
			Email:     user.Email,
			Username:  user.Username,
			Name:      user.Name,
			CreatedAt: user.CreatedAt,
		},
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *authService) generateToken(user *domain.User, secret string, expiry time.Duration) (string, error) {
	claims := jwtClaims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiry)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func (s *authService) parseToken(tokenStr, secret string) (*jwtClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &jwtClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, apperror.ErrInvalidToken
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, apperror.ErrInvalidToken
	}

	claims, ok := token.Claims.(*jwtClaims)
	if !ok || !token.Valid {
		return nil, apperror.ErrInvalidToken
	}

	return claims, nil
}

func refreshTokenKey(userID, token string) string {
	return "refresh:" + userID + ":" + token
}
