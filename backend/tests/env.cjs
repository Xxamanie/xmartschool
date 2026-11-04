process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-only-session-secret-with-at-least-sixty-four-characters-123456';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.ENABLE_DEMO_AUTH = 'false';
process.env.SMTP_HOST = '';
process.env.SUPABASE_URL = 'https://test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
