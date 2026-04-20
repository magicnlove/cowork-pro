CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('personal', 'team', 'announcement')),
  attendee_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_time_order CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_range ON events (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by);
