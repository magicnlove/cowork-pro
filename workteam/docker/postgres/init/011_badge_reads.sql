-- 네비게이션 배지 마지막 확인 시각 (채팅은 channel_reads 별도 사용)

CREATE TABLE IF NOT EXISTS user_badge_reads (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  badge_type VARCHAR(32) NOT NULL CHECK (badge_type IN ('tasks', 'calendar', 'notes', 'activity')),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_user_badge_reads_user ON user_badge_reads (user_id);
