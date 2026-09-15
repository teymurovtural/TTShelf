CREATE TABLE fonts (
                       id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                       user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                       name       VARCHAR(255) NOT NULL,
                       file_key   VARCHAR(500) NOT NULL,
                       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fonts_user_id ON fonts(user_id);