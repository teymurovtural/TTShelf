CREATE TABLE canvas_pages (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id   UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    page_number INTEGER NOT NULL DEFAULT 1,
    title       VARCHAR(255),
    orientation VARCHAR(20) NOT NULL DEFAULT 'portrait'
        CHECK (orientation IN ('portrait', 'landscape')),
    locked      BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_canvas_pages_canvas_id ON canvas_pages(canvas_id);
CREATE INDEX idx_canvas_pages_order     ON canvas_pages(canvas_id, page_number);
