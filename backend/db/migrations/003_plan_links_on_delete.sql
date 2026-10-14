-- Um treino registado a partir de um plano fica ligado ao dia do plano
-- (workout_sessions.plan_day_id). Sem ON DELETE, editar ou apagar esse
-- plano depois disso falhava (as edições recriam os dias). Agora o treino
-- fica, só perde a ligação ao dia. O mesmo para set_logs.plan_exercise_id.
-- Já incluído no schema.sql; isto é só para bases de dados criadas antes.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/003_plan_links_on_delete.sql
ALTER TABLE workout_sessions
    DROP CONSTRAINT IF EXISTS workout_sessions_plan_day_id_fkey,
    ADD CONSTRAINT workout_sessions_plan_day_id_fkey
        FOREIGN KEY (plan_day_id) REFERENCES plan_days(id) ON DELETE SET NULL;

ALTER TABLE set_logs
    DROP CONSTRAINT IF EXISTS set_logs_plan_exercise_id_fkey,
    ADD CONSTRAINT set_logs_plan_exercise_id_fkey
        FOREIGN KEY (plan_exercise_id) REFERENCES plan_exercises(id) ON DELETE SET NULL;
