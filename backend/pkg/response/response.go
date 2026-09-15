package response

import (
	"encoding/json"
	"net/http"

	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
)

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *ErrorBody  `json:"error,omitempty"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func OK(w http.ResponseWriter, data interface{}) {
	write(w, http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func Created(w http.ResponseWriter, data interface{}) {
	write(w, http.StatusCreated, Response{
		Success: true,
		Data:    data,
	})
}

func Error(w http.ResponseWriter, err *apperror.AppError) {
	write(w, err.HTTPStatus, Response{
		Success: false,
		Error: &ErrorBody{
			Code:    err.Code,
			Message: err.Message,
		},
	})
}

func write(w http.ResponseWriter, status int, body Response) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
