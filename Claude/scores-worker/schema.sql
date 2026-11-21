-- One row per run on the shared list. See worker.js for the meaning of the columns.
CREATE TABLE IF NOT EXISTS scores (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  game TEXT    NOT NULL,
  k    TEXT    NOT NULL UNIQUE,
  n    TEXT    NOT NULL,
  s    INTEGER NOT NULL,
  w    INTEGER NOT NULL,
  d    TEXT    NOT NULL,
  t    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS scores_top ON scores (game, s DESC, id);
