CREATE TABLE book_annotations (
                                  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                  book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
                                  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                  page_number INTEGER NOT NULL,
                                  x           FLOAT NOT NULL,
                                  y           FLOAT NOT NULL,
                                  width       FLOAT NOT NULL,
                                  height      FLOAT NOT NULL,
                                  color       VARCHAR(50) NOT NULL DEFAULT '#FFFF00',
                                  note        TEXT,
                                  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_book_annotations_book_id ON book_annotations(book_id);
CREATE INDEX idx_book_annotations_user_id ON book_annotations(user_id);