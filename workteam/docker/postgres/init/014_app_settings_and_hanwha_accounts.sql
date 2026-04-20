-- 전역 앱 설정(JSON) + 한화 시드 계정(@hanwha.com)

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES (
  'navigation_menus',
  '{
    "dashboard": true,
    "chat": true,
    "tasks": true,
    "calendar": true,
    "meeting_notes": true,
    "activity_feed": true,
    "archive": true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 초기 계정: 비밀번호는 평문과 동일, bcrypt cost 12 (애플리케이션과 동일)
INSERT INTO users (id, email, password_hash, name, role) VALUES
  (
    'b0000001-0000-4000-8000-000000000001'::uuid,
    'admin@hanwha.com',
    '$2b$12$0O0mFS5/y1YEyzeQuwOjN.z2gp1qJCA3MV1oY5dX0o.uqpOFCG97O',
    '한화 관리자',
    'admin'
  ),
  (
    'b0000002-0000-4000-8000-000000000002'::uuid,
    'manager@hanwha.com',
    '$2b$12$ilta4yWHDiuEOiOlQJDKwOX0tnw.ipwbvhenDokpSDUf2DJgd.ncy',
    '한화 매니저',
    'manager'
  ),
  (
    'b0000003-0000-4000-8000-000000000003'::uuid,
    'member1@hanwha.com',
    '$2b$12$CSdSa/jZNpbR49Q/ja6dKuoRD2mQzoT5EmHvVcKsSfvQSoTf1djy6',
    '한화 멤버1',
    'member'
  ),
  (
    'b0000004-0000-4000-8000-000000000004'::uuid,
    'member2@hanwha.com',
    '$2b$12$2uPC9MXiGXzcTh0iRrYSceikObzzMFec2GFujkloxdHaTU56.Nrfe',
    '한화 멤버2',
    'member'
  )
ON CONFLICT (email) DO NOTHING;
