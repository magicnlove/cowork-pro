CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action_type VARCHAR(40) NOT NULL CHECK (
    action_type IN (
      'message_sent',
      'task_created',
      'task_moved',
      'task_completed',
      'note_created',
      'note_updated',
      'file_uploaded',
      'event_created',
      'member_joined'
    )
  ),
  entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('channel', 'task', 'note', 'event', 'file')),
  entity_id UUID NOT NULL,
  entity_name VARCHAR(500) NOT NULL,
  department_id UUID REFERENCES departments (id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_department ON activity_logs (department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs (action_type, created_at DESC);

