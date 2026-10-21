-- Exercícios personalizados: cada pessoa pode criar os seus próprios, só
-- visíveis para ela (owner_id definido) — distintos dos exercícios
-- partilhados do ginásio (owner_id NULL). gym_id passa a nullable para
-- contas sem ginásio também poderem criar os seus.
ALTER TABLE exercises ALTER COLUMN gym_id DROP NOT NULL;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_exercises_owner ON exercises(owner_id);
