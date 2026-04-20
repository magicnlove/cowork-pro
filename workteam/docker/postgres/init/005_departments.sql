-- 조직(부서) 트리, 채널 확장, 태스크/일정 부서 연동
-- 기존 볼륨에 수동 적용 시에도 동일 순서로 실행 가능하도록 IF NOT EXISTS / DO 블록 사용

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  code VARCHAR(64) NOT NULL UNIQUE,
  parent_id UUID REFERENCES departments (id) ON DELETE SET NULL,
  manager_user_id UUID REFERENCES users (id) ON DELETE SET NULL,
  depth INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_parent ON departments (parent_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments (id) ON DELETE SET NULL;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'member'));

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments (id) ON DELETE SET NULL;

ALTER TABLE events ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments (id) ON DELETE SET NULL;

ALTER TABLE channels ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments (id) ON DELETE SET NULL;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users (id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id UUID NOT NULL REFERENCES channels (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members (user_id);

-- 레거시 CHECK 제거 후 kind 확장
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_dm_consistency;
ALTER TABLE channels DROP CONSTRAINT IF EXISTS channels_kind_check;

UPDATE channels SET kind = 'company_wide' WHERE kind = 'channel';

UPDATE channels
SET kind = 'cross_team',
  created_by = COALESCE(
    created_by,
    (SELECT id FROM users WHERE email = 'admin@company.com' LIMIT 1)
  )
WHERE slug = 'dev-team';

UPDATE channels SET name = '# 전체공지' WHERE slug = 'announcements';
UPDATE channels SET name = '# 자유게시판' WHERE slug = 'general';

ALTER TABLE channels ADD CONSTRAINT channels_kind_check CHECK (
  kind IN ('dm', 'company_wide', 'department', 'cross_team')
);

ALTER TABLE channels ADD CONSTRAINT channels_dm_users CHECK (
  (kind = 'dm' AND dm_user_a_id IS NOT NULL AND dm_user_b_id IS NOT NULL AND department_id IS NULL)
  OR (kind <> 'dm' AND dm_user_a_id IS NULL AND dm_user_b_id IS NULL)
);

ALTER TABLE channels ADD CONSTRAINT channels_company_wide CHECK (
  (kind = 'company_wide' AND department_id IS NULL)
  OR (kind <> 'company_wide')
);

ALTER TABLE channels ADD CONSTRAINT channels_department_link CHECK (
  (kind = 'department' AND department_id IS NOT NULL)
  OR (kind <> 'department')
);

ALTER TABLE channels ADD CONSTRAINT channels_cross_team_creator CHECK (
  (kind = 'cross_team' AND created_by IS NOT NULL)
  OR (kind <> 'cross_team')
);

-- ---- 시드: 부서 트리 (없을 때만 삽입) ----

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '한화투자증권', 'HWINV', NULL, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM departments WHERE code = 'HWINV');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '혁신지원실', 'INV-SUP', d.id, 1, 0
FROM departments d
WHERE d.code = 'HWINV'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'INV-SUP');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '경영관리실', 'MGMT', d.id, 1, 1
FROM departments d
WHERE d.code = 'HWINV'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'MGMT');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '미래전략실', 'FUTURE', d.id, 1, 2
FROM departments d
WHERE d.code = 'HWINV'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'FUTURE');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '인재관리팀', 'INV-HR', d.id, 2, 0
FROM departments d
WHERE d.code = 'INV-SUP'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'INV-HR');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '운영지원팀', 'INV-OPS', d.id, 2, 1
FROM departments d
WHERE d.code = 'INV-SUP'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'INV-OPS');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '오퍼레이션팀', 'INV-OPER', d.id, 2, 2
FROM departments d
WHERE d.code = 'INV-SUP'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'INV-OPER');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '디지털L&D센터', 'INV-DLD', d.id, 2, 3
FROM departments d
WHERE d.code = 'INV-SUP'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'INV-DLD');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '경영기획팀', 'MGMT-PLAN', d.id, 2, 0
FROM departments d
WHERE d.code = 'MGMT'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'MGMT-PLAN');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '회계팀', 'MGMT-ACC', d.id, 2, 1
FROM departments d
WHERE d.code = 'MGMT'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'MGMT-ACC');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT 'ESG사무국', 'MGMT-ESG', d.id, 2, 2
FROM departments d
WHERE d.code = 'MGMT'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'MGMT-ESG');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '자금팀', 'MGMT-TREAS', d.id, 2, 3
FROM departments d
WHERE d.code = 'MGMT'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'MGMT-TREAS');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '글로벌시너지팀', 'FUT-GLSYN', d.id, 2, 0
FROM departments d
WHERE d.code = 'FUTURE'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'FUT-GLSYN');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '전략팀', 'FUT-STRAT', d.id, 2, 1
FROM departments d
WHERE d.code = 'FUTURE'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'FUT-STRAT');

INSERT INTO departments (name, code, parent_id, depth, sort_order)
SELECT '글로벌지원팀', 'FUT-GLSUP', d.id, 2, 2
FROM departments d
WHERE d.code = 'FUTURE'
  AND NOT EXISTS (SELECT 1 FROM departments WHERE code = 'FUT-GLSUP');

-- 시드 사용자 부서 배정
UPDATE users u
SET
  department_id = d.id
FROM departments d
WHERE d.code = 'HWINV'
  AND u.email = 'admin@company.com';

UPDATE users u
SET
  department_id = d.id
FROM departments d
WHERE d.code = 'INV-HR'
  AND u.email = 'member@company.com';

-- 태스크 부서 백필
UPDATE tasks t
SET
  department_id = u.department_id
FROM users u
WHERE u.id = t.created_by
  AND t.department_id IS NULL;

-- 부서 채널 자동 생성 (slug = dept-<코드 소문자>)
INSERT INTO channels (slug, name, kind, department_id)
SELECT
  'dept-' || lower(d.code),
  '#' || d.name || ' · 부서',
  'department',
  d.id
FROM departments d
WHERE NOT EXISTS (SELECT 1 FROM channels c WHERE c.department_id = d.id AND c.kind = 'department');

-- 크로스팀(dev-team) 멤버: 시드 사용자 전원 초대
INSERT INTO channel_members (channel_id, user_id)
SELECT c.id, u.id
FROM channels c
  CROSS JOIN users u
WHERE c.slug = 'dev-team'
ON CONFLICT DO NOTHING;

-- 크로스팀 생성자는 멤버 테이블에 없어도 접근 가능하나, 목록 일관성을 위해 포함됨
