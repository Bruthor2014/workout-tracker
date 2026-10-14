-- Permite remover pessoas da equipa (gestão do CEO) sem perder dados: o que
-- apontava para a pessoa removida fica sem ligação (SET NULL) em vez de
-- impedir a remoção. Um plano com created_by NULL passa a significar
-- "criado por alguém que já saiu do ginásio" (os colegas da mesma
-- especialidade podem continuar a editá-lo). Já incluído no schema.sql.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/009_remove_people.sql
ALTER TABLE member_subscriptions
    DROP CONSTRAINT IF EXISTS member_subscriptions_assigned_staff_id_fkey,
    ADD CONSTRAINT member_subscriptions_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE body_metrics
    DROP CONSTRAINT IF EXISTS body_metrics_recorded_by_fkey,
    ADD CONSTRAINT body_metrics_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE workout_plans ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE workout_plans
    DROP CONSTRAINT IF EXISTS workout_plans_created_by_fkey,
    ADD CONSTRAINT workout_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE nutrition_plans
    DROP CONSTRAINT IF EXISTS nutrition_plans_created_by_fkey,
    ADD CONSTRAINT nutrition_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
