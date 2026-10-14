-- Reformulação das tabelas de financeiro para o modelo correto:
-- Salário base, taxas horárias por tipo de trabalho, taxa mensal PT por cliente,
-- e retenção do ginásio (% ou € fixo).

ALTER TABLE staff_rates
  DROP COLUMN IF EXISTS rate_per_session,
  DROP COLUMN IF EXISTS rate_per_class,
  ADD COLUMN IF NOT EXISTS rate_reception_h DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_sala_h      DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_class_h     DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_pt_month    DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gym_cut_pct      DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS gym_cut_fixed    DECIMAL(10,2);

ALTER TABLE payroll_weeks
  DROP COLUMN IF EXISTS sessions_count,
  DROP COLUMN IF EXISTS classes_count,
  ADD COLUMN IF NOT EXISTS hours_reception   DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hours_sala        DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hours_class       DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pt_clients_count  INT          NOT NULL DEFAULT 0;
