package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/teymurovtural/ttshelf-backend/pkg/apperror"
	"github.com/teymurovtural/ttshelf-backend/pkg/response"
	"golang.org/x/time/rate"
)

type client struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	clients map[string]*client
	mu      sync.Mutex
	rps     rate.Limit
	burst   int
}

func NewRateLimiter(rps float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		clients: make(map[string]*client),
		rps:     rate.Limit(rps),
		burst:   burst,
	}

	// Köhnə clientləri hər dəqiqə təmizlə
	go rl.cleanup()

	return rl
}

func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getIP(r)

		rl.mu.Lock()
		if _, exists := rl.clients[ip]; !exists {
			rl.clients[ip] = &client{
				limiter: rate.NewLimiter(rl.rps, rl.burst),
			}
		}
		rl.clients[ip].lastSeen = time.Now()
		limiter := rl.clients[ip].limiter
		rl.mu.Unlock()

		if !limiter.Allow() {
			response.Error(w, apperror.New(
				"RATE_LIMIT_EXCEEDED",
				"Çox sayda sorğu göndərdiniz. Bir az gözləyin.",
				http.StatusTooManyRequests,
			))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (rl *RateLimiter) cleanup() {
	for {
		time.Sleep(time.Minute)
		rl.mu.Lock()
		for ip, c := range rl.clients {
			if time.Since(c.lastSeen) > 3*time.Minute {
				delete(rl.clients, ip)
			}
		}
		rl.mu.Unlock()
	}
}

func getIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}
