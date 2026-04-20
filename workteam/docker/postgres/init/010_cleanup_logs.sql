-- 파일 자동 삭제 정리 이력

CREATE TABLE IF NOT EXISTS cleanup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  files_deleted INTEGER NOT NULL DEFAULT 0 CHECK (files_deleted >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cleanup_logs_run_at ON cleanup_logs (run_at DESC);
