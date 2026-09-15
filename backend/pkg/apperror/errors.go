package apperror

import "net/http"

type AppError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	HTTPStatus int    `json:"-"`
}

func (e *AppError) Error() string {
	return e.Message
}

func New(code, message string, status int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		HTTPStatus: status,
	}
}

// Auth xətaları
var (
	ErrInvalidEmail = &AppError{
		Code:       "INVALID_EMAIL",
		Message:    "Email formatı düzgün deyil",
		HTTPStatus: http.StatusBadRequest,
	}
	ErrInvalidUsername = &AppError{
		Code:       "INVALID_USERNAME",
		Message:    "Username yalnız hərf, rəqəm və alt xətt içərə bilər (3-50 simvol)",
		HTTPStatus: http.StatusBadRequest,
	}
	ErrPasswordTooShort = &AppError{
		Code:       "PASSWORD_TOO_SHORT",
		Message:    "Şifrə minimum 8 simvol olmalıdır",
		HTTPStatus: http.StatusBadRequest,
	}
	ErrPasswordTooLong = &AppError{
		Code:       "PASSWORD_TOO_LONG",
		Message:    "Şifrə maksimum 72 simvol ola bilər",
		HTTPStatus: http.StatusBadRequest,
	}
	ErrNameTooShort = &AppError{
		Code:       "NAME_TOO_SHORT",
		Message:    "Ad minimum 2 simvol olmalıdır",
		HTTPStatus: http.StatusBadRequest,
	}
	ErrNameTooLong = &AppError{
		Code:       "NAME_TOO_LONG",
		Message:    "Ad maksimum 100 simvol ola bilər",
		HTTPStatus: http.StatusBadRequest,
	}
	ErrEmailTaken = &AppError{
		Code:       "EMAIL_TAKEN",
		Message:    "Bu email artıq qeydiyyatdan keçib",
		HTTPStatus: http.StatusConflict,
	}
	ErrUsernameTaken = &AppError{
		Code:       "USERNAME_TAKEN",
		Message:    "Bu username artıq istifadədədir",
		HTTPStatus: http.StatusConflict,
	}
	ErrInvalidCredentials = &AppError{
		Code:       "INVALID_CREDENTIALS",
		Message:    "Email və ya şifrə yanlışdır",
		HTTPStatus: http.StatusUnauthorized,
	}
	ErrInvalidToken = &AppError{
		Code:       "INVALID_TOKEN",
		Message:    "Token etibarsızdır və ya müddəti bitib",
		HTTPStatus: http.StatusUnauthorized,
	}
	ErrTokenNotFound = &AppError{
		Code:       "TOKEN_NOT_FOUND",
		Message:    "Token tapılmadı",
		HTTPStatus: http.StatusUnauthorized,
	}
	ErrInternalError = &AppError{
		Code:       "INTERNAL_ERROR",
		Message:    "Daxili server xətası",
		HTTPStatus: http.StatusInternalServerError,
	}
	ErrInvalidRequestBody = &AppError{
		Code:       "INVALID_REQUEST_BODY",
		Message:    "Sorğu gövdəsi düzgün deyil",
		HTTPStatus: http.StatusBadRequest,
	}
)
