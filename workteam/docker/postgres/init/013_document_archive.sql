-- 파일 아카이브(워크스페이스·문서) + activity_logs 확장
-- 기존 activity_logs CHECK 제약 확장 (문서·워크스페이스 이벤트)

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_type_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_action_type_check CHECK (
  action_type IN (
    'message_sent',
    'task_created',
    'task_moved',
    'task_completed',
    'note_created',
    'note_updated',
    'file_uploaded',
    'event_created',
    'member_joined',
    'document_viewed',
    'document_created',
    'document_updated',
    'document_version_created',
    'document_approved',
    'document_archived',
    'workspace_member_role_changed'
  )
);

ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS activity_logs_entity_type_check;
ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_entity_type_check CHECK (
  entity_type IN ('channel', 'task', 'note', 'event', 'file', 'document', 'workspace')
);

-- ---------------------------------------------------------------------------
-- 워크스페이스
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('org', 'custom')),
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces (created_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces (created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('viewer', 'editor', 'owner')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members (user_id);

-- ---------------------------------------------------------------------------
-- 문서 (폴더: 루트 3종 + 선택적 1단 하위, 최대 2 depth)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  folder VARCHAR(500) NOT NULL CHECK (
    folder ~ '^(in_progress|completed|reference)(/[^/]+)?$'
  ),
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'in_review', 'approved', 'archived')),
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents (workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_folder ON documents (workspace_id, folder);
CREATE INDEX IF NOT EXISTS idx_documents_workspace_status ON documents (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents (created_at DESC);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  version_number INT NOT NULL CHECK (version_number >= 1),
  change_summary TEXT,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (document_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions (document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions (created_at DESC);

-- ---------------------------------------------------------------------------
-- 감사 로그 (API에서 권한 변경·문서 이벤트 기록)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action VARCHAR(80) NOT NULL,
  target_id UUID,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_ts ON audit_logs (user_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_ts ON audit_logs (target_id, "timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON audit_logs ("timestamp" DESC);
