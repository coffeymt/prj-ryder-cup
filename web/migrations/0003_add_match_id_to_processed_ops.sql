-- Add match_id column to processed_ops for scoped idempotency.
ALTER TABLE processed_ops ADD COLUMN match_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS processed_ops_op_match
  ON processed_ops (op_id, match_id);
