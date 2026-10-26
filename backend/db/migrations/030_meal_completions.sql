-- Marcar, por dia, se uma refeição do plano de nutrição foi concluída
-- (checkbox "já comi isto hoje" — ver NutritionPlanCard.jsx). Uma linha por
-- refeição/dia; apagar a linha desmarca. Só quem é dono do plano marca as
-- suas próprias refeições (ver nutritionController.js findOwnPlan).
--   psql -U <user> -d workout_tracker -f backend/db/migrations/030_meal_completions.sql
CREATE TABLE IF NOT EXISTS meal_completions (
    id            SERIAL PRIMARY KEY,
    meal_slot_id  INTEGER NOT NULL REFERENCES meal_slots(id) ON DELETE CASCADE,
    member_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (meal_slot_id, member_id, completed_at)
);
CREATE INDEX IF NOT EXISTS idx_meal_completions_member_date ON meal_completions(member_id, completed_at);
