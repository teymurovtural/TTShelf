package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/teymurovtural/ttshelf-backend/internal/domain"
)

type userRepository struct {
	db *pgxpool.Pool
}

func NewUserRepository(db *pgxpool.Pool) domain.UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) Create(ctx context.Context, req *domain.RegisterRequest, passwordHash string) (*domain.User, error) {
	query := `
		INSERT INTO users (email, username, name, password_hash, is_verified)
		VALUES ($1, $2, $3, $4, FALSE)
		RETURNING id, email, username, name, password_hash, is_verified, otp_code, otp_expires_at, created_at, updated_at
	`
	return r.scanUser(ctx, query, req.Email, req.Username, req.Name, passwordHash)
}

func (r *userRepository) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	query := `
		SELECT id, email, username, name, password_hash, is_verified, otp_code, otp_expires_at, created_at, updated_at
		FROM users WHERE email = $1
	`
	return r.scanUser(ctx, query, email)
}

func (r *userRepository) GetByUsername(ctx context.Context, username string) (*domain.User, error) {
	query := `
		SELECT id, email, username, name, password_hash, is_verified, otp_code, otp_expires_at, created_at, updated_at
		FROM users WHERE username = $1
	`
	return r.scanUser(ctx, query, username)
}

func (r *userRepository) GetByID(ctx context.Context, id string) (*domain.User, error) {
	query := `
		SELECT id, email, username, name, password_hash, is_verified, otp_code, otp_expires_at, created_at, updated_at
		FROM users WHERE id = $1
	`
	return r.scanUser(ctx, query, id)
}

func (r *userRepository) EmailExists(ctx context.Context, email string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, email).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check email: %w", err)
	}
	return exists, nil
}

func (r *userRepository) UsernameExists(ctx context.Context, username string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check username: %w", err)
	}
	return exists, nil
}

func (r *userRepository) SetOTP(ctx context.Context, userID, otpCode string, expiresAt time.Time) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3`,
		otpCode, expiresAt, userID,
	)
	if err != nil {
		return fmt.Errorf("set otp: %w", err)
	}
	return nil
}

func (r *userRepository) VerifyEmail(ctx context.Context, userID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expires_at = NULL WHERE id = $1`,
		userID,
	)
	if err != nil {
		return fmt.Errorf("verify email: %w", err)
	}
	return nil
}

func (r *userRepository) scanUser(ctx context.Context, query string, args ...any) (*domain.User, error) {
	user := &domain.User{}
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&user.ID, &user.Email, &user.Username, &user.Name,
		&user.PasswordHash, &user.IsVerified,
		&user.OTPCode, &user.OTPExpiresAt,
		&user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan user: %w", err)
	}
	return user, nil
}
