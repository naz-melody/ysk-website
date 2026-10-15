CREATE TABLE content (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE login_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset_at INTEGER NOT NULL);
CREATE TABLE icons (member_id TEXT PRIMARY KEY, mime TEXT NOT NULL, bytes BLOB NOT NULL);
