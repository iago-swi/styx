CREATE TABLE IF NOT EXISTS runs (
  k TEXT NOT NULL UNIQUE,
  n TEXT NOT NULL,
  s INTEGER NOT NULL,
  w INTEGER NOT NULL,
  t INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_score ON runs(s DESC);
-- Only anonymous admission times are needed for the global sliding window.
-- Keep them independently of the leaderboard so pruning cannot reset the limit.
CREATE TABLE IF NOT EXISTS admissions (t INTEGER NOT NULL);
CREATE TRIGGER IF NOT EXISTS count_admission AFTER INSERT ON runs
BEGIN
  INSERT INTO admissions(t) VALUES (NEW.t);
END;
