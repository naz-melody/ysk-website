CREATE TABLE admin_auth (id INTEGER PRIMARY KEY CHECK(id = 1), password_hash TEXT NOT NULL, owner_id TEXT, updated_at INTEGER NOT NULL);
ALTER TABLE sessions ADD COLUMN auth_fingerprint TEXT;
CREATE INDEX login_limits_expiry ON login_limits(reset_at);
