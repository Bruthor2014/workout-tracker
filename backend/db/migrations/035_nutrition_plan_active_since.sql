-- psql -U postgres -d workout_tracker -f backend/db/migrations/035_nutrition_plan_active_since.sql

-- Desde quando este plano está ativo (não é o mesmo que created_at — o
-- plano pode ter sido criado semanas antes de ser escolhido como ativo, ou
-- a pessoa pode ter trocado de plano ativo várias vezes). Serve para
-- mostrar "Ativo há X dias" em vez de só "Plano ativo".
ALTER TABLE nutrition_plans
    ADD COLUMN IF NOT EXISTS active_since TIMESTAMPTZ;

-- Backfill: para quem já está ativo agora, assume-se desde a criação do
-- plano (é o melhor que se sabe sem histórico).
UPDATE nutrition_plans SET active_since = created_at
 WHERE is_active AND active_since IS NULL;
