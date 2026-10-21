-- Técnica planeada para cada exercício de um plano (normal, drop set,
-- rest-pause, cluster, super-set, pirâmide ou até à falha — mesmas opções
-- de set_logs.set_type, ver 004/005_*). Até agora só se escolhia a técnica
-- ao registar o treino; passa a poder-se planear à partida.
-- Já incluído no schema.sql; isto é só para bases de dados criadas antes
-- desta alteração.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/028_plan_exercise_set_type.sql
ALTER TABLE plan_exercises
    ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (set_type IN ('normal', 'drop', 'rest_pause', 'cluster', 'superset', 'pyramid', 'failure'));
