package service

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/teymurovtural/ttshelf-backend/internal/config"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/mailer"
	"golang.org/x/crypto/bcrypt"
)

var (
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,30}$`)
)

const (
	otpTTL         = 10 * time.Minute
	resendCooldown = 60 * time.Second
)

type authService struct {
	userRepo domain.UserRepository
	redis    *redis.Client
	cfg      *config.JWTConfig
	mailer   *mailer.Mailer
}

func NewAuthService(
	userRepo domain.UserRepository,
	redis *redis.Client,
	cfg *config.JWTConfig,
	m *mailer.Mailer,
) domain.AuthService {
	return &authService{userRepo: userRepo, redis: redis, cfg: cfg, mailer: m}
}

func (s *authService) Register(ctx context.Context, req *domain.RegisterRequest) (*domain.RegisterResponse, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Username = strings.TrimSpace(req.Username)
	req.Name = strings.TrimSpace(req.Name)

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

	if err := s.sendOTP(ctx, user); err != nil {
		return nil, apperror.ErrInternalError
	}

	return &domain.RegisterResponse{
		Email:   user.Email,
		Message: fmt.Sprintf("%s ünvanına 6 rəqəmli kod göndərildi. Zəhmət olmasa emailinizi yoxlayın.", user.Email),
	}, nil
}

func (s *authService) VerifyOTP(ctx context.Context, req *domain.VerifyOTPRequest) (*domain.AuthResponse, error) {
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.OTP = strings.TrimSpace(req.OTP)

	if len(req.OTP) != 6 {
		return nil, apperror.ErrOTPInvalid
	}

	user, err := s.userRepo.GetByEmail(ctx, req.Email)
	if err != nil {
		return nil, apperror.ErrUserNotFound
	}
	if user.IsVerified {
		return nil, apperror.ErrOTPAlreadyVerified
	}
	if user.OTPCode == nil || user.OTPExpiresAt == nil {
		return nil, apperror.ErrOTPInvalid
	}
	if time.Now().After(*user.OTPExpiresAt) {
		return nil, apperror.ErrOTPExpired
	}
	if *user.OTPCode != req.OTP {
		return nil, apperror.ErrOTPInvalid
	}

	if err := s.userRepo.VerifyEmail(ctx, user.ID); err != nil {
		return nil, apperror.ErrInternalError
	}

	user.IsVerified = true
	return s.buildAuthResponse(ctx, user)
}

func (s *authService) ResendOTP(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))

	cooldownKey := "otp_cooldown:" + email
	exists, _ := s.redis.Exists(ctx, cooldownKey).Result()
	if exists > 0 {
		return apperror.ErrTooManyRequests
	}

	user, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		// Təhlükəsizlik: istifadəçi tapılmasa da eyni cavab ver
		return nil
	}
	if user.IsVerified {
		return apperror.ErrOTPAlreadyVerified
	}

	if err := s.sendOTP(ctx, user); err != nil {
		return apperror.ErrInternalError
	}

	s.redis.Set(ctx, cooldownKey, 1, resendCooldown)
	return nil
}

func (s *authService) Login(ctx context.Context, req *domain.LoginRequest) (*domain.AuthResponse, error) {
	req.Identifier = strings.TrimSpace(req.Identifier)

	var user *domain.User
	var err error

	if emailRegex.MatchString(req.Identifier) {
		user, err = s.userRepo.GetByEmail(ctx, strings.ToLower(req.Identifier))
	} else {
		user, err = s.userRepo.GetByUsername(ctx, req.Identifier)
	}

	if err != nil {
		return nil, apperror.ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, apperror.ErrInvalidCredentials
	}

	if !user.IsVerified {
		return nil, apperror.ErrEmailNotVerified
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
	s.redis.Del(ctx, refreshTokenKey(claims.UserID, refreshToken))
	return nil
}

// --- helpers ---

func (s *authService) sendOTP(ctx context.Context, user *domain.User) error {
	otp, err := generateOTP()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(otpTTL)
	if err := s.userRepo.SetOTP(ctx, user.ID, otp, expiresAt); err != nil {
		return err
	}
	go func() {
		if err := s.mailer.SendOTP(user.Email, user.Name, otp); err != nil {
			log.Printf("SMTP xətası: %v", err)
		}
	}()
	return nil
}

func generateOTP() (string, error) {
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	n := (int(b[0])<<16 | int(b[1])<<8 | int(b[2])) % 1_000_000
	return fmt.Sprintf("%06d", n), nil
}

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
			ID: user.ID, Email: user.Email, Username: user.Username,
			Name: user.Name, IsVerified: user.IsVerified, CreatedAt: user.CreatedAt,
		},
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *authService) generateToken(user *domain.User, secret string, expiry time.Duration) (string, error) {
	claims := jwtClaims{
		UserID: user.ID, Email: user.Email,
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
