package domain

import (
	"context"
	"time"
)

type User struct {
	ID           string     `json:"id"`
	Email        string     `json:"email"`
	Username     string     `json:"username"`
	Name         string     `json:"name"`
	PasswordHash string     `json:"-"`
	IsVerified   bool       `json:"is_verified"`
	OTPCode      *string    `json:"-"`
	OTPExpiresAt *time.Time `json:"-"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

type UserResponse struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	Username   string    `json:"username"`
	Name       string    `json:"name"`
	IsVerified bool      `json:"is_verified"`
	CreatedAt  time.Time `json:"created_at"`
}

type UserRepository interface {
	Create(ctx context.Context, req *RegisterRequest, passwordHash string) (*User, error)
	GetByEmail(ctx context.Context, email string) (*User, error)
	GetByUsername(ctx context.Context, username string) (*User, error)
	GetByID(ctx context.Context, id string) (*User, error)
	EmailExists(ctx context.Context, email string) (bool, error)
	UsernameExists(ctx context.Context, username string) (bool, error)
	SetOTP(ctx context.Context, userID, otpCode string, expiresAt time.Time) error
	VerifyEmail(ctx context.Context, userID string) error
}

type AuthService interface {
	Register(ctx context.Context, req *RegisterRequest) (*RegisterResponse, error)
	VerifyOTP(ctx context.Context, req *VerifyOTPRequest) (*AuthResponse, error)
	ResendOTP(ctx context.Context, email string) error
	Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error)
	Refresh(ctx context.Context, refreshToken string) (*AuthResponse, error)
	Logout(ctx context.Context, refreshToken string) error
}

type UserService interface {
	GetMe(ctx context.Context, userID string) (*UserResponse, error)
}

type RegisterRequest struct {
	Email    string `json:"email"`
	Username string `json:"username"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// Identifier: username və ya email qəbul edir
type LoginRequest struct {
	Identifier string `json:"identifier"`
	Password   string `json:"password"`
}

type VerifyOTPRequest struct {
	Email string `json:"email"`
	OTP   string `json:"otp"`
}

type ResendOTPRequest struct {
	Email string `json:"email"`
}

type RegisterResponse struct {
	Email   string `json:"email"`
	Message string `json:"message"`
}

type AuthResponse struct {
	User         UserResponse `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"-"`
}
