-- Taxas de remuneração por staff (uma entrada por pessoa×ginásio)
CREATE TABLE IF NOT EXISTS staff_rates (
  staff_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id     INT NOT NULL REFERENCES gyms(id)  ON DELETE CASCADE,
  rate_per_session  DECIMAL(10,2) NOT NULL DEFAULT 0,
  rate_per_class    DECIMAL(10,2) NOT NULL DEFAULT 0,
  base_salary       DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, gym_id)
);

-- Registos semanais de sessões/aulas realizadas (snapshot confirmável pelo CEO)
CREATE TABLE IF NOT EXISTS payroll_weeks (
  id            SERIAL PRIMARY KEY,
  staff_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id        INT NOT NULL REFERENCES gyms(id)  ON DELETE CASCADE,
  week_start    DATE NOT NULL,
  sessions_count INT NOT NULL DEFAULT 0,
  classes_count  INT NOT NULL DEFAULT 0,
  notes          TEXT,
  confirmed      BOOLEAN NOT NULL DEFAULT false,
  confirmed_by   INT REFERENCES users(id),
  confirmed_at   TIMESTAMPTZ,
  UNIQUE(staff_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_payroll_gym_week ON payroll_weeks(gym_id, week_start);

-- Check-ins do ginásio (ocupação em tempo real)
CREATE TABLE IF NOT EXISTS gym_checkins (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id         INT NOT NULL REFERENCES gyms(id)  ON DELETE CASCADE,
  checked_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_checkins_active ON gym_checkins(gym_id, user_id) WHERE checked_out_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_checkins_gym_date ON gym_checkins(gym_id, checked_in_at);
