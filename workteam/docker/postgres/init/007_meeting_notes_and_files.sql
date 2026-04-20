-- 미팅노트 + 공통 파일 첨부

CREATE TABLE IF NOT EXISTS file_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('chat_message', 'task', 'meeting_note')),
  entity_id UUID NOT NULL,
  uploaded_by UUID REFERENCES users (id) ON DELETE SET NULL,
  original_name VARCHAR(500) NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(200) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_entity ON file_attachments (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_created ON file_attachments (created_at DESC);

CREATE TABLE IF NOT EXISTS meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meeting_notes_dept ON meeting_notes (department_id);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_updated ON meeting_notes (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_notes_sort ON meeting_notes (department_id, sort_order, updated_at DESC);

ALTER TABLE meeting_notes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY department_id ORDER BY updated_at DESC, created_at DESC) - 1 AS rn
  FROM meeting_notes
)
UPDATE meeting_notes n
SET sort_order = o.rn
FROM ordered o
WHERE o.id = n.id
  AND n.sort_order = 0;

CREATE TABLE IF NOT EXISTS meeting_note_attendees (
  note_id UUID NOT NULL REFERENCES meeting_notes (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, user_id)
);

CREATE TABLE IF NOT EXISTS note_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES meeting_notes (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  block_type VARCHAR(32) NOT NULL CHECK (block_type IN ('heading', 'paragraph', 'checklist', 'divider')),
  body TEXT,
  checklist_items JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_note_blocks_note ON note_blocks (note_id, sort_order);
