CREATE TABLE canvas_elements (
                                 id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                                 canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
                                 type      VARCHAR(50) NOT NULL,
                                 data      JSONB NOT NULL DEFAULT '{}',
                                 z_index   INTEGER NOT NULL DEFAULT 0,
                                 created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                                 updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_canvas_elements_canvas_id ON canvas_elements(canvas_id);
CREATE INDEX idx_canvas_elements_data ON canvas_elements USING GIN(data);