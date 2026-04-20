-- 겸임(복수 소속) 구조: users.department_id -> user_departments

CREATE TABLE IF NOT EXISTS user_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, department_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_departments_primary_one
  ON user_departments (user_id)
  WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments (user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept ON user_departments (department_id);

-- 기존 단일 소속 이관
INSERT INTO user_departments (user_id, department_id, is_primary, role)
SELECT
  u.id,
  u.department_id,
  TRUE AS is_primary,
  CASE
    WHEN u.role IN ('admin', 'manager', 'member') THEN u.role
    ELSE 'member'
  END AS role
FROM users u
WHERE u.department_id IS NOT NULL
ON CONFLICT (user_id, department_id) DO UPDATE
SET
  is_primary = EXCLUDED.is_primary,
  role = EXCLUDED.role;

ALTER TABLE users DROP COLUMN IF EXISTS department_id;

