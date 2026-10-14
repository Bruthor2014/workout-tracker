-- Tipo de cada série registada: 'normal' ou 'drop' (drop set — o mesmo
-- exercício seguido, a baixar o peso e a fazer o máximo de reps em cada
-- drop). Já incluído no schema.sql; isto é só para bases de dados criadas
-- antes desta alteração.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/004_set_types.sql
ALTER TABLE set_logs
    ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (set_type IN ('normal', 'drop'));
