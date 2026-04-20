-- 태스크별 네비 알림 읽음 (담당자 기준, DB 영속)

CREATE TABLE IF NOT EXISTS user_task_reads (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_user_task_reads_user ON user_task_reads (user_id);
