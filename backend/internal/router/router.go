package router

import (
	"fmt"
	"net/http"
	"strings"

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

	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.Recoverer)
	r.Use(chimiddleware.Logger)
	r.Use(middleware.CORS(splitOrigins(allowedOrigins), env))
	r.Use(middleware.NewRateLimiter(10, 20).Limit)

	r.Get("/swagger/*", httpswagger.Handler(
		httpswagger.URL("/swagger/doc.json"),
	))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintln(w, "OK")
	})

	r.Route("/api/v1", func(r chi.Router) {

		// Public — auth
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register",   h.Auth.Register)
			r.Post("/verify-otp", h.Auth.VerifyOTP)
			r.Post("/resend-otp", h.Auth.ResendOTP)
			r.Post("/login",      h.Auth.Login)
			r.Post("/refresh",    h.Auth.Refresh)
			r.Delete("/logout",   h.Auth.Logout)
		})

		// Protected
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(jwtSecret))

			r.Route("/users", func(r chi.Router) {
				r.Get("/me", h.User.GetMe)
			})

			r.Route("/books", func(r chi.Router) {
				r.Get("/",           h.Book.GetAll)
				r.Post("/",          h.Book.Upload)
				r.Get("/{id}",       h.Book.GetByID)
				r.Delete("/{id}",    h.Book.Delete)
				r.Get("/{id}/file",  h.Book.StreamFile)
				r.Put("/{id}/bookmark", h.Book.UpdateBookmark)

				r.Get("/{id}/annotations",        h.Annotation.GetByBookID)
				r.Post("/{id}/annotations",        h.Annotation.Create)
				r.Put("/{id}/annotations/{aid}",   h.Annotation.Update)
				r.Delete("/{id}/annotations/{aid}", h.Annotation.Delete)
			})

			r.Route("/upload", func(r chi.Router) {
				r.Post("/image", h.Upload.UploadImage)
				r.Post("/font",  h.Upload.UploadFont)
			})

			r.Route("/fonts", func(r chi.Router) {
				r.Get("/",        h.Font.GetAll)
				r.Post("/",       h.Font.Upload)
				r.Delete("/{id}", h.Font.Delete)
			})

			r.Route("/canvases", func(r chi.Router) {
				r.Get("/",    h.Canvas.GetAll)
				r.Post("/",   h.Canvas.Create)
				r.Get("/{id}",    h.Canvas.GetByID)
				r.Put("/{id}",    h.Canvas.UpdateTitle)
				r.Delete("/{id}", h.Canvas.Delete)

				r.Get("/{id}/elements",         h.Canvas.GetElements)
				r.Post("/{id}/elements",         h.Canvas.CreateElement)
				r.Post("/{id}/elements/batch",   h.Canvas.BatchSaveElements)
				r.Put("/{id}/elements/{eid}",    h.Canvas.UpdateElement)
				r.Delete("/{id}/elements/{eid}", h.Canvas.DeleteElement)

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
	parts := strings.Split(origins, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			result = append(result, t)
		}
	}
	return result
}
