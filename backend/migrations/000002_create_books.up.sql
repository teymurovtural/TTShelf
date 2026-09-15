CREATE TABLE books (
                       id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                       user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                       title       VARCHAR(500) NOT NULL,
                       author      VARCHAR(255),
                       file_key    VARCHAR(500) NOT NULL,
                       file_size   BIGINT NOT NULL DEFAULT 0,
                       last_page   INTEGER NOT NULL DEFAULT 1,
                       total_pages INTEGER NOT NULL DEFAULT 0,
                       created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                       updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_books_user_id ON books(user_id);