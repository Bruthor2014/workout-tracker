-- Com mais do que um plano de nutrição, o membro escolhe qual está
-- "ativo" — só esse conta para a estatística de refeições cumpridas
-- (ver GET /nutrition-plans/completion-summary). No máximo um ativo por
-- membro, garantido pelo índice único parcial abaixo.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/031_nutrition_plan_active.sql
ALTER TABLE nutrition_plans
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_nutrition_plans_one_active
    ON nutrition_plans(member_id) WHERE is_active;

-- Quem já tinha plano(s) antes desta coluna existir: ativa o mais recente
-- de cada membro, para ninguém ficar sem nenhum ativo (e sem a estatística
-- deixar de aparecer de repente).
WITH latest AS (
  SELECT DISTINCT ON (member_id) id
    FROM nutrition_plans
   ORDER BY member_id, created_at DESC
)
UPDATE nutrition_plans SET is_active = true
 WHERE id IN (SELECT id FROM latest)
   AND NOT EXISTS (
     SELECT 1 FROM nutrition_plans np2
      WHERE np2.member_id = nutrition_plans.member_id AND np2.is_active
   );
