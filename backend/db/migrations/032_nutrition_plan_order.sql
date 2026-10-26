-- Ordem manual dos planos de nutrição de cada membro (lista colapsada —
-- ver NutritionPage.jsx — passa a dar para reordenar em vez de ficar
-- sempre por data de criação).
--   psql -U <user> -d workout_tracker -f backend/db/migrations/032_nutrition_plan_order.sql
ALTER TABLE nutrition_plans
    ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- Quem já tinha planos antes desta coluna existir: numera-os pela ordem em
-- que já apareciam (mais recente primeiro, como a lista sempre mostrou).
WITH numbered AS (
  SELECT id, row_number() OVER (PARTITION BY member_id ORDER BY created_at DESC) - 1 AS rn
    FROM nutrition_plans
)
UPDATE nutrition_plans np SET order_index = numbered.rn
  FROM numbered
 WHERE numbered.id = np.id AND np.order_index = 0;
