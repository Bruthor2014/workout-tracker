-- 022: tabela monthly_payments — nunca tinha sido criada em nenhuma
-- migração nem no schema.sql, só existia numa BD viva de outra máquina
-- (o mesmo problema que já aconteceu com staff_attendance e com
-- gyms.accent_color/secondary_color). Reconstruída a partir do uso em
-- financeController.js (listPayments/createPayment/deletePayment/
-- getMyPayments).
CREATE TABLE IF NOT EXISTS monthly_payments (
  id                SERIAL PRIMARY KEY,
  staff_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id            INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  month_year        DATE NOT NULL,
  hours_sala        NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_reception   NUMERIC(8,2) NOT NULL DEFAULT 0,
  hours_class       NUMERIC(8,2) NOT NULL DEFAULT 0,
  pt_clients_count  INTEGER NOT NULL DEFAULT 0,
  absent_hours      NUMERIC(8,2) NOT NULL DEFAULT 0,
  gross             NUMERIC(10,2) NOT NULL DEFAULT 0,
  gym_cut           NUMERIC(10,2) NOT NULL DEFAULT 0,
  absent_deduction  NUMERIC(10,2) NOT NULL DEFAULT 0,
  net               NUMERIC(10,2) NOT NULL DEFAULT 0,
  confirmed_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes             TEXT,
  paid_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, month_year)
);
CREATE INDEX IF NOT EXISTS idx_monthly_payments_gym_month ON monthly_payments(gym_id, month_year);
