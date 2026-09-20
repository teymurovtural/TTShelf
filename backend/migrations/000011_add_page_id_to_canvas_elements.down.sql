DROP INDEX IF EXISTS idx_canvas_elements_page_id;

ALTER TABLE canvas_elements
    DROP COLUMN IF EXISTS page_id;
