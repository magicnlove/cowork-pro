-- 채팅: 그룹 DM, 읽음, 반응, 고정, 메시지 수정/삭제, 멤버 역할

-- messages 확장
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- channel_members 역할 (host / member)
ALTER TABLE channel_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
ALTER TABLE channel_members DROP CONSTRAINT IF EXISTS channel_members_role_check;
ALTER TABLE channel_members ADD CONSTRAINT channel_members_role_check CHECK (role IN ('host', 'member'));

UPDATE channel_members cm
SET role = 'host'
FROM channels c
WHERE cm.channel_id = c.id
  AND c.kind = 'cross_team'
  AND c.created_by = cm.user_id;

-- group_dm kind 추가
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_kind_check;
ALTER TABLE channels ADD CONSTRAINT channels_kind_check CHECK (
  kind IN ('dm', 'company_wide', 'department', 'cross_team', 'group_dm')
);

ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_cross_team_creator;

ALTER TABLE channels ADD CONSTRAINT channels_hosted_kinds CHECK (
  (kind IN ('cross_team', 'group_dm') AND created_by IS NOT NULL)
  OR kind NOT IN ('cross_team', 'group_dm')
);

-- 읽음 표시
CREATE TABLE IF NOT EXISTS channel_reads (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT TO_TIMESTAMP(0),
  PRIMARY KEY (user_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_reads_channel ON channel_reads (channel_id);

-- 이모지 반응 (토글: 동일 사용자·이모지 유일)
CREATE TABLE IF NOT EXISTS message_reactions (
  message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT message_reactions_emoji_allowed CHECK (emoji IN ('👍', '❤️', '😂', '😮', '😢', '🎉'))
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions (message_id);

-- 고정 메시지
CREATE TABLE IF NOT EXISTS channel_pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_pinned_channel ON channel_pinned_messages (channel_id);

-- 부서 채널 표시명에서 ' · 부서' 제거
UPDATE channels
SET name = TRIM(REPLACE(name, ' · 부서', ''))
WHERE kind = 'department' AND name LIKE '% · 부서%';
