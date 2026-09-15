# ---- Build stage ----
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Dependency-ləri əvvəlcə yüklə (cache üçün)
COPY go.mod go.sum ./
RUN go mod download

# Kodu kopyala və binary yığ
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o ttshelf ./cmd/server

# ---- Run stage ----
FROM alpine:3.20

WORKDIR /app

# TLS sertifikatları (HTTPS sorğular üçün lazımdır)
RUN apk --no-cache add ca-certificates tzdata

# Yalnız binary kopyala
COPY --from=builder /app/ttshelf .

# Migration faylları
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080

CMD ["./ttshelf"]