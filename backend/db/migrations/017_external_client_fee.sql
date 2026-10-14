-- 017: monthly_fee por cliente externo (o PT define quanto cobra a cada um)
ALTER TABLE external_coach_clients ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
