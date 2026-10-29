-- Ordem escolhida pelo membro na lista colapsada (PlansPage.jsx), igual ao
-- que já existe em nutrition_plans.order_index — não é por data de criação.
ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;
