-- 1. page_id sütununu əlavə et (nullable — köhnə elementlər pozulmur)
ALTER TABLE canvas_elements
    ADD COLUMN page_id UUID REFERENCES canvas_pages(id) ON DELETE CASCADE;

CREATE INDEX idx_canvas_elements_page_id ON canvas_elements(page_id);

-- 2. Mövcud hər canvas üçün default page yarat
--    və həmin canvas-ın bütün elementlərini o page-ə köçür
DO $$
DECLARE
    rec RECORD;
    new_page_id UUID;
BEGIN
    FOR rec IN SELECT id FROM canvases LOOP
        INSERT INTO canvas_pages (canvas_id, page_number, title, orientation)
        VALUES (rec.id, 1, 'Səhifə 1', 'portrait')
        RETURNING id INTO new_page_id;

        UPDATE canvas_elements
        SET page_id = new_page_id
        WHERE canvas_id = rec.id
          AND page_id IS NULL;
    END LOOP;
END;
$$;
