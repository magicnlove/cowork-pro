-- 비밀번호 관리: 임시 비밀번호 플래그 + 재설정 요청
-- is_temp_password: 관리자·승인 플로우에서 TRUE로 설정. 기존 DB 행 보호를 위해 DEFAULT는 FALSE.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'completed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user ON password_reset_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests (status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_password_reset_one_pending
  ON password_reset_requests (user_id)
  WHERE status = 'pending';
