CREATE TABLE canvases (
                          id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                          user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                          book_id       UUID REFERENCES books(id) ON DELETE SET NULL,
                          title         VARCHAR(500) NOT NULL DEFAULT 'Untitled',
                          thumbnail_key VARCHAR(500),
                          created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                          updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_canvases_user_id ON canvases(user_id);
CREATE INDEX idx_canvases_book_id ON canvases(book_id);