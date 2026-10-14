-- Per-occurrence class confirmations (instructor + reception two-part sign-off)
CREATE TABLE IF NOT EXISTS class_occurrences (
  id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES group_classes(id) ON DELETE CASCADE,
  gym_id   INT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  instructor_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  instructor_confirmed_at  TIMESTAMPTZ,
  reception_confirmed      BOOLEAN NOT NULL DEFAULT FALSE,
  reception_confirmed_at   TIMESTAMPTZ,
  UNIQUE(class_id, class_date)
);

-- Minutes before class start within which a pending substitute request triggers auto-cancel
ALTER TABLE group_classes ADD COLUMN IF NOT EXISTS sub_cutoff_minutes INT NOT NULL DEFAULT 30;
