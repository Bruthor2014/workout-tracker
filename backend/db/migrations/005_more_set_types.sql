-- Mais tipos de série além de normal/drop: rest-pause, cluster, super-set,
-- pirâmide e até à falha. Já incluído no schema.sql; isto é só para bases
-- de dados criadas antes desta alteração.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/005_more_set_types.sql
ALTER TABLE set_logs
    DROP CONSTRAINT IF EXISTS set_logs_set_type_check,
    ADD CONSTRAINT set_logs_set_type_check
        CHECK (set_type IN ('normal', 'drop', 'rest_pause', 'cluster', 'superset', 'pyramid', 'failure'));
