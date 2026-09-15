package middleware

import (
	"net/http"

	"github.com/rs/cors"
)

func CORS(allowedOrigins []string, env string) func(http.Handler) http.Handler {
	options := cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
		ExposedHeaders:   []string{"X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}

	if env == "development" {
		options.AllowedOrigins = []string{"*"}
		options.AllowCredentials = false
	}

	c := cors.New(options)
	return c.Handler
}
