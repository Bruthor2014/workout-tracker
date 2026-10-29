-- Partilha dirigida de planos (treino ou nutrição) a um amigo específico —
-- quem recebe decide se quer copiar para a sua conta (ver plan_shares.status);
-- nunca copia sozinho só por ter sido partilhado.
CREATE TABLE plan_shares (
    id            SERIAL PRIMARY KEY,
    plan_type     VARCHAR(10) NOT NULL CHECK (plan_type IN ('workout', 'nutrition')),
    plan_id       INTEGER NOT NULL,
    -- Nome do plano no momento da partilha — continua a aparecer na caixa de
    -- entrada mesmo que o original seja editado ou apagado depois.
    plan_name     VARCHAR(150) NOT NULL,
    from_user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'copied', 'dismissed')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at  TIMESTAMPTZ
);
CREATE INDEX idx_plan_shares_to_user ON plan_shares(to_user_id, status);
