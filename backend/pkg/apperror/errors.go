package apperror

import "net/http"

type AppError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	HTTPStatus int    `json:"-"`
}

func (e *AppError) Error() string { return e.Message }

func New(code, message string, status int) *AppError {
	return &AppError{Code: code, Message: message, HTTPStatus: status}
}

var (
	ErrInvalidEmail = &AppError{
		Code: "INVALID_EMAIL", Message: "Email formatı düzgün deyil", HTTPStatus: http.StatusBadRequest,
	}
	ErrInvalidUsername = &AppError{
		Code: "INVALID_USERNAME", Message: "Username yalnız hərf, rəqəm və alt xətt içərə bilər (3-30 simvol)", HTTPStatus: http.StatusBadRequest,
	}
	ErrPasswordTooShort = &AppError{
		Code: "PASSWORD_TOO_SHORT", Message: "Şifrə minimum 8 simvol olmalıdır", HTTPStatus: http.StatusBadRequest,
	}
	ErrPasswordTooLong = &AppError{
		Code: "PASSWORD_TOO_LONG", Message: "Şifrə maksimum 72 simvol ola bilər", HTTPStatus: http.StatusBadRequest,
	}
	ErrNameTooShort = &AppError{
		Code: "NAME_TOO_SHORT", Message: "Ad minimum 2 simvol olmalıdır", HTTPStatus: http.StatusBadRequest,
	}
	ErrNameTooLong = &AppError{
		Code: "NAME_TOO_LONG", Message: "Ad maksimum 100 simvol ola bilər", HTTPStatus: http.StatusBadRequest,
	}
	ErrEmailTaken = &AppError{
		Code: "EMAIL_TAKEN", Message: "Bu email artıq qeydiyyatdan keçib", HTTPStatus: http.StatusConflict,
	}
	ErrUsernameTaken = &AppError{
		Code: "USERNAME_TAKEN", Message: "Bu username artıq istifadədədir", HTTPStatus: http.StatusConflict,
	}
	ErrInvalidCredentials = &AppError{
		Code: "INVALID_CREDENTIALS", Message: "İstifadəçi adı/email və ya şifrə yanlışdır", HTTPStatus: http.StatusUnauthorized,
	}
	ErrInvalidToken = &AppError{
		Code: "INVALID_TOKEN", Message: "Token etibarsızdır və ya müddəti bitib", HTTPStatus: http.StatusUnauthorized,
	}
	ErrTokenNotFound = &AppError{
		Code: "TOKEN_NOT_FOUND", Message: "Token tapılmadı", HTTPStatus: http.StatusUnauthorized,
	}
	ErrInternalError = &AppError{
		Code: "INTERNAL_ERROR", Message: "Daxili server xətası", HTTPStatus: http.StatusInternalServerError,
	}
	ErrInvalidRequestBody = &AppError{
		Code: "INVALID_REQUEST_BODY", Message: "Sorğu gövdəsi düzgün deyil", HTTPStatus: http.StatusBadRequest,
	}
	ErrEmailNotVerified = &AppError{
		Code: "EMAIL_NOT_VERIFIED", Message: "Email ünvanınız təsdiqlənməyib. Zəhmət olmasa emailinizə göndərilən kodu daxil edin", HTTPStatus: http.StatusForbidden,
	}
	ErrOTPInvalid = &AppError{
		Code: "OTP_INVALID", Message: "Daxil etdiyiniz kod yanlışdır", HTTPStatus: http.StatusBadRequest,
	}
	ErrOTPExpired = &AppError{
		Code: "OTP_EXPIRED", Message: "Kodun müddəti bitib. Yeni kod tələb edin", HTTPStatus: http.StatusBadRequest,
	}
	ErrOTPAlreadyVerified = &AppError{
		Code: "ALREADY_VERIFIED", Message: "Email ünvanınız artıq təsdiqlənib", HTTPStatus: http.StatusBadRequest,
	}
	ErrUserNotFound = &AppError{
		Code: "USER_NOT_FOUND", Message: "İstifadəçi tapılmadı", HTTPStatus: http.StatusNotFound,
	}
	ErrTooManyRequests = &AppError{
		Code: "TOO_MANY_REQUESTS", Message: "Çox sayda sorğu. Bir az gözləyin", HTTPStatus: http.StatusTooManyRequests,
	}
)
