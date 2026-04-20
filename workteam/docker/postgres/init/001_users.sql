CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 고정 UUID: DB 볼륨 재생성 후에도 동일 이메일 로그인 시 JWT sub가 시드와 일치하도록 함 (JWT_SECRET은 .env 유지)
INSERT INTO users (id, email, password_hash, name, role)
VALUES (
  'a0000001-0000-4000-8000-000000000001'::uuid,
  'admin@company.com',
  '$2b$12$PA4AyK1RGfNbQEFkcMQApenWuu8qZDmRcR.YTNpCbOzQZ2ku.OAaq',
  '시스템 관리자',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
