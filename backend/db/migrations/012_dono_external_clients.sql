-- 012: role "dono" (dono da plataforma), gym_id nullable,
--      códigos de convite e tabela de clientes externos.

-- 1. Novo role na enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dono';

-- 2. gym_id passa a ser nullable (DONO e clientes externos não pertencem a um ginásio)
ALTER TABLE users ALTER COLUMN gym_id DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gym_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_gym_id_fkey
  FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE SET NULL;

-- 3. Código de convite único para PTs e nutricionistas
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;

-- 4. Clientes externos: pessoas que usam a app mas não são sócias do ginásio,
--    ligadas a um coach (PT / nutricionista) via código de convite.
CREATE TABLE IF NOT EXISTS external_coach_clients (
    id          SERIAL PRIMARY KEY,
    coach_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_id      INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ext_clients_coach ON external_coach_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_ext_clients_client ON external_coach_clients(client_id);
