-- 아카이브: 문서 댓글, 버전 본문, 첨부(document), 상태 컬럼 제거

-- ---------------------------------------------------------------------------
-- 문서 댓글
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_comments_doc_created
  ON document_comments (document_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 첨부: entity_type 에 document 추가
-- ---------------------------------------------------------------------------
ALTER TABLE file_attachments DROP CONSTRAINT IF EXISTS file_attachments_entity_type_check;
ALTER TABLE file_attachments ADD CONSTRAINT file_attachments_entity_type_check CHECK (
  entity_type IN ('chat_message', 'task', 'meeting_note', 'document')
);

-- ---------------------------------------------------------------------------
-- 버전 본문 + 승인 플래그 제거
-- ---------------------------------------------------------------------------
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';
ALTER TABLE document_versions DROP COLUMN IF EXISTS is_approved;

-- ---------------------------------------------------------------------------
-- 문서 상태 컬럼 및 인덱스 제거
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_documents_workspace_status;
ALTER TABLE documents DROP COLUMN IF EXISTS status;
