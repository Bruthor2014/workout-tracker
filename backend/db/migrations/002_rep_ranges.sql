-- Reps alvo como intervalo nos planos (ex: 8-12): target_reps passa a ser o
-- mínimo e target_reps_max o máximo (NULL quando é um número só). Já
-- incluído no schema.sql; isto é só para bases de dados criadas antes.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/002_rep_ranges.sql
ALTER TABLE plan_exercises
    ADD COLUMN IF NOT EXISTS target_reps_max INTEGER;
