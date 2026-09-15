package router

import (
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	httpswagger "github.com/swaggo/http-swagger/v2"
	"github.com/teymurovtural/ttshelf-backend/internal/handler"
	"github.com/teymurovtural/ttshelf-backend/internal/middleware"

	_ "github.com/teymurovtural/ttshelf-backend/docs"
)

type Handlers struct {
	Auth       *handler.AuthHandler
	User       *handler.UserHandler
	Book       *handler.BookHandler
	Canvas     *handler.CanvasHandler
	Annotation *handler.AnnotationHandler
	Upload     *handler.UploadHandler
	Font       *handler.FontHandler
	Export     *handler.ExportHandler
}

func New(h *Handlers, jwtSecret, allowedOrigins, env string) http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Logger)
	r.Use(middleware.CORS(splitOrigins(allowedOrigins), env))
	r.Use(middleware.NewRateLimiter(10, 20).Limit)

	// Swagger
	r.Get("/swagger/*", httpswagger.Handler(
		httpswagger.URL("http://localhost:9090/swagger/doc.json"),
	))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "OK")
	})

	// API v1
	r.Route("/api/v1", func(r chi.Router) {

		// Public routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Auth.Register)
			r.Post("/login", h.Auth.Login)
			r.Post("/refresh", h.Auth.Refresh)
			r.Delete("/logout", h.Auth.Logout)
		})

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(jwtSecret))

			// Users
			r.Route("/users", func(r chi.Router) {
				r.Get("/me", h.User.GetMe)
			})

			// Books
			r.Route("/books", func(r chi.Router) {
				r.Get("/", h.Book.GetAll)
				r.Post("/", h.Book.Upload)
				r.Get("/{id}", h.Book.GetByID)
				r.Delete("/{id}", h.Book.Delete)
				r.Get("/{id}/file", h.Book.StreamFile)
				r.Put("/{id}/bookmark", h.Book.UpdateBookmark)

				// Annotations
				r.Get("/{id}/annotations", h.Annotation.GetByBookID)
				r.Post("/{id}/annotations", h.Annotation.Create)
				r.Put("/{id}/annotations/{aid}", h.Annotation.Update)
				r.Delete("/{id}/annotations/{aid}", h.Annotation.Delete)
			})

			// Upload (file only, no DB)
			r.Route("/upload", func(r chi.Router) {
				r.Post("/image", h.Upload.UploadImage)
				r.Post("/font", h.Upload.UploadFont)
			})

			// Fonts (file + DB)
			r.Route("/fonts", func(r chi.Router) {
				r.Get("/", h.Font.GetAll)
				r.Post("/", h.Font.Upload)
				r.Delete("/{id}", h.Font.Delete)
			})

			// Canvases
			r.Route("/canvases", func(r chi.Router) {
				r.Get("/", h.Canvas.GetAll)
				r.Post("/", h.Canvas.Create)
				r.Get("/{id}", h.Canvas.GetByID)
				r.Put("/{id}", h.Canvas.UpdateTitle)
				r.Delete("/{id}", h.Canvas.Delete)

				// Elements
				r.Get("/{id}/elements", h.Canvas.GetElements)
				r.Post("/{id}/elements", h.Canvas.CreateElement)
				r.Post("/{id}/elements/batch", h.Canvas.BatchSaveElements)
				r.Put("/{id}/elements/{eid}", h.Canvas.UpdateElement)
				r.Delete("/{id}/elements/{eid}", h.Canvas.DeleteElement)

				// Export
				r.Post("/{id}/export/pdf", h.Export.ExportPDF)
			})
		})
	})

	return r
}

func splitOrigins(origins string) []string {
	if origins == "" {
		return []string{"*"}
	}
	result := []string{}
	start := 0
	for i := 0; i < len(origins); i++ {
		if origins[i] == ',' {
			result = append(result, origins[start:i])
			start = i + 1
		}
	}
	result = append(result, origins[start:])
	return result
}
