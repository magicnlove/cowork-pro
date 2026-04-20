CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('backlog', 'in_progress', 'in_review', 'done')),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  due_date DATE,
  assignee_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_status_position ON tasks (status, position ASC);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);

DO $$
DECLARE
  admin_id UUID;
  member_id UUID;
  assignee_alt UUID;
BEGIN
  SELECT id INTO admin_id FROM users WHERE email = 'admin@company.com' LIMIT 1;
  SELECT id INTO member_id FROM users WHERE email = 'member@company.com' LIMIT 1;
  assignee_alt := COALESCE(member_id, admin_id);

  IF admin_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tasks LIMIT 1) THEN
  INSERT INTO tasks (title, description, status, priority, due_date, assignee_user_id, tags, position, created_by)
  VALUES
    (
      '디자인 시스템 가이드 초안',
      '색상·타이포·간격 토큰 정리',
      'backlog',
      'high',
      CURRENT_DATE + 7,
      admin_id,
      ARRAY['design', 'docs']::TEXT[],
      0,
      admin_id
    ),
    (
      'API 인증 흐름 검토',
      NULL,
      'in_progress',
      'medium',
      CURRENT_DATE + 3,
      assignee_alt,
      ARRAY['backend']::TEXT[],
      0,
      admin_id
    ),
    (
      '칸반 보드 UX 피드백 반영',
      '드래그·모달 동작 확인',
      'in_review',
      'low',
      CURRENT_DATE + 1,
      assignee_alt,
      ARRAY['frontend']::TEXT[],
      0,
      admin_id
    ),
    (
      '주간 스탠드업 노트',
      NULL,
      'done',
      'low',
      CURRENT_DATE - 1,
      assignee_alt,
      ARRAY['meeting']::TEXT[],
      0,
      admin_id
    );
  END IF;
END $$;
