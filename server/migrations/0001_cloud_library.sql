CREATE TABLE libraries (
  owner TEXT NOT NULL,
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  revision TEXT NOT NULL,
  word_count INTEGER NOT NULL CHECK(word_count BETWEEN 1 AND 20000),
  byte_length INTEGER NOT NULL CHECK(byte_length BETWEEN 1 AND 10485760),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (owner, id)
);

-- Structured study snapshots are split to stay well below D1's row-size limit.
-- Metadata and every part are updated in one transaction, never piecemeal.
CREATE TABLE library_parts (
  owner TEXT NOT NULL,
  library_id TEXT NOT NULL,
  part_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (owner, library_id, part_index),
  FOREIGN KEY (owner, library_id) REFERENCES libraries(owner, id) ON DELETE CASCADE
);
