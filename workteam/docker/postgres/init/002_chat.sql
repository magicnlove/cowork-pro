CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('channel', 'dm')),
  dm_user_a_id UUID REFERENCES users (id) ON DELETE CASCADE,
  dm_user_b_id UUID REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT channels_dm_consistency CHECK (
    (kind = 'channel' AND dm_user_a_id IS NULL AND dm_user_b_id IS NULL)
    OR (kind = 'dm' AND dm_user_a_id IS NOT NULL AND dm_user_b_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_dm_pair ON channels (
  LEAST(dm_user_a_id, dm_user_b_id),
  GREATEST(dm_user_a_id, dm_user_b_id)
)
WHERE kind = 'dm';

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  parent_message_id UUID REFERENCES messages (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_time ON messages (channel_id, created_at);

CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (parent_message_id)
WHERE parent_message_id IS NOT NULL;

INSERT INTO users (id, email, password_hash, name, role)
VALUES (
  'a0000002-0000-4000-8000-000000000002'::uuid,
  'member@company.com',
  '$2b$12$1dClTdC9zUQ6eBh.U3ZZYuYV5J9jlCCXAx7q1zUDFpwvwVd3KwVKa',
  '김철수',
  'member'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO channels (slug, name, kind)
VALUES
  ('general', '일반', 'channel'),
  ('announcements', '공지사항', 'channel'),
  ('dev-team', '개발팀', 'channel')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO channels (slug, name, kind, dm_user_a_id, dm_user_b_id)
SELECT
  'dm-admin-member',
  'DM',
  'dm',
  (SELECT id FROM users WHERE email = 'admin@company.com' LIMIT 1),
  (SELECT id FROM users WHERE email = 'member@company.com' LIMIT 1)
WHERE EXISTS (SELECT 1 FROM users WHERE email = 'admin@company.com')
  AND EXISTS (SELECT 1 FROM users WHERE email = 'member@company.com')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO messages (channel_id, user_id, body, parent_message_id)
SELECT c.id, u.id, '내부망 협업 채팅에 오신 것을 환영합니다.', NULL
FROM channels c
JOIN users u ON u.email = 'admin@company.com'
WHERE c.slug = 'general'
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.channel_id = c.id);
