-- Add is_anonymous column to qna_questions
ALTER TABLE qna_questions ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- Create index for filtering anonymous questions
CREATE INDEX IF NOT EXISTS idx_qna_questions_is_anonymous ON qna_questions(is_anonymous);
