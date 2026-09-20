// @title           TTShelf API
// @version         1.0
// @description     TTShelf — Personal Knowledge Management System API
// @host            localhost:9090
// @BasePath        /api/v1
// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/teymurovtural/ttshelf-backend/internal/config"
	"github.com/teymurovtural/ttshelf-backend/internal/database"
	"github.com/teymurovtural/ttshelf-backend/internal/handler"
	"github.com/teymurovtural/ttshelf-backend/internal/repository"
	"github.com/teymurovtural/ttshelf-backend/internal/router"
	"github.com/teymurovtural/ttshelf-backend/internal/service"
	"github.com/teymurovtural/ttshelf-backend/internal/storage"
	"github.com/teymurovtural/ttshelf-backend/pkg/logger"
	"github.com/teymurovtural/ttshelf-backend/pkg/mailer"
)

func main() {
	cfg := config.Load()

	if err := logger.Init(cfg.Server.Env); err != nil {
		log.Fatalf("Failed to initialize logger: %v", err)
	}
	defer logger.Sync()

	if err := database.RunMigrations(&cfg.Database); err != nil {
		logger.Fatal("Failed to run migrations")
	}

	db, err := database.NewPostgresPool(&cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to PostgreSQL")
	}
	defer db.Close()

	rdb, err := database.NewRedisClient(&cfg.Redis)
	if err != nil {
		logger.Fatal("Failed to connect to Redis")
	}
	defer rdb.Close()

	minioClient, err := storage.NewMinioClient(&cfg.Minio)
	if err != nil {
		logger.Fatal("Failed to connect to MinIO")
	}

	m := mailer.New(&cfg.SMTP)

	// Repositories
	userRepo       := repository.NewUserRepository(db)
	bookRepo       := repository.NewBookRepository(db)
	canvasRepo     := repository.NewCanvasRepository(db)
	pageRepo       := repository.NewPageRepository(db)
	annotationRepo := repository.NewAnnotationRepository(db)
	fontRepo       := repository.NewFontRepository(db)

	// Services
	authSvc       := service.NewAuthService(userRepo, rdb, &cfg.JWT, m)
	userSvc       := service.NewUserService(userRepo)
	bookSvc       := service.NewBookService(bookRepo, minioClient)
	canvasSvc     := service.NewCanvasService(canvasRepo)
	pageSvc       := service.NewPageService(pageRepo, canvasRepo)
	annotationSvc := service.NewAnnotationService(annotationRepo, bookRepo)
	fontSvc       := service.NewFontService(fontRepo, cfg.Minio.PublicURL, cfg.Minio.BucketName)

	// Handlers
	handlers := &router.Handlers{
		Auth:       handler.NewAuthHandler(authSvc, &cfg.JWT, &cfg.Server),
		User:       handler.NewUserHandler(userSvc),
		Book:       handler.NewBookHandler(bookSvc),
		Canvas:     handler.NewCanvasHandler(canvasSvc),
		Page:       handler.NewPageHandler(pageSvc, canvasSvc),
		Annotation: handler.NewAnnotationHandler(annotationSvc),
		Upload:     handler.NewUploadHandler(minioClient, cfg.Minio.PublicURL),
		Font:       handler.NewFontHandler(fontSvc, minioClient),
		Export:     handler.NewExportHandler(canvasSvc, minioClient, cfg.Minio.PublicURL),
	}

	r := router.New(handlers, cfg.JWT.AccessSecret, cfg.Server.AllowedOrigins, cfg.Server.Env)

	addr := fmt.Sprintf("%s:%s", cfg.Server.Host, cfg.Server.Port)
	logger.Info("TTShelf backend starting on " + addr)

	if err := http.ListenAndServe(addr, r); err != nil {
		logger.Fatal("Server failed")
	}
}
