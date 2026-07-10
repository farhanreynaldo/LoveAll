CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  organizer_token TEXT NOT NULL,
  completed_at INTEGER NOT NULL,
  standings_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_organizer
  ON sessions (organizer_token, completed_at DESC);
