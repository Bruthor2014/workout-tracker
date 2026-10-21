-- Até agora um exercício de um plano tinha um único alvo (séries/reps/carga)
-- aplicado a todas as séries por igual. Passa a ter uma linha por série —
-- tal como set_logs guarda o que foi feito, plan_exercise_sets guarda o que
-- está planeado — para dar para variar (ex: pirâmide: 12 reps @ 40kg,
-- 10 @ 50kg, 8 @ 60kg).
--   psql -U <user> -d workout_tracker -f backend/db/migrations/029_plan_exercise_sets.sql
CREATE TABLE IF NOT EXISTS plan_exercise_sets (
    id                SERIAL PRIMARY KEY,
    plan_exercise_id  INTEGER NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE,
    set_number        INTEGER NOT NULL,
    target_reps       INTEGER,
    -- Máximo quando as reps alvo são um intervalo (ex: 8-12 -> 8 e 12);
    -- NULL quando é um número só.
    target_reps_max   INTEGER,
    target_load       NUMERIC(6,2)
);
CREATE INDEX IF NOT EXISTS idx_plan_exercise_sets_pe ON plan_exercise_sets(plan_exercise_id);

-- Migra o alvo único de cada exercício (target_sets séries, todas iguais)
-- para uma linha por série, antes de remover as colunas antigas. Só corre
-- se ainda houver algo para migrar (plan_exercises ainda com target_sets) —
-- repetir este ficheiro numa base já migrada não faz nada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'plan_exercises' AND column_name = 'target_sets'
  ) THEN
    INSERT INTO plan_exercise_sets (plan_exercise_id, set_number, target_reps, target_reps_max, target_load)
    SELECT pe.id, s, pe.target_reps, pe.target_reps_max, pe.target_load
      FROM plan_exercises pe
     CROSS JOIN LATERAL generate_series(1, GREATEST(pe.target_sets, 1)) AS s
     WHERE NOT EXISTS (SELECT 1 FROM plan_exercise_sets WHERE plan_exercise_id = pe.id);

    ALTER TABLE plan_exercises
        DROP COLUMN target_sets,
        DROP COLUMN target_reps,
        DROP COLUMN target_reps_max,
        DROP COLUMN target_load;
  END IF;
END $$;
