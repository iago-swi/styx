-- One row per run on the shared STYX // NEON ABYSS high-score list.
-- Stored per run: key, initials, score, level reached, UTC date, and timestamp (ms).
-- No IP address, user agent, or browser details are stored.
CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  k  TEXT    NOT NULL UNIQUE,
  n  TEXT    NOT NULL,
  s  INTEGER NOT NULL,
  w  INTEGER NOT NULL,
  d  TEXT    NOT NULL,
  t  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_top ON scores (s DESC, id);
CREATE INDEX IF NOT EXISTS scores_time ON scores (t);
