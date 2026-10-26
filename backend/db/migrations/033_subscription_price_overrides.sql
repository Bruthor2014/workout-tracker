-- psql -U postgres -d workout_tracker -f backend/db/migrations/033_subscription_price_overrides.sql

-- Preço negociado por membro (ex: desconto, promoção, plano anual em vez de
-- mensal) — sobrepõe-se ao preço fixo de gym_service_prices só para esse
-- membro/serviço. Sem linha aqui, continua a valer o preço do ginásio
-- (ver fetchSubscriptionsForMember em subscriptionController.js).
CREATE TABLE IF NOT EXISTS subscription_price_overrides (
    id              SERIAL PRIMARY KEY,
    member_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type    service_type NOT NULL,
    price_cents     INTEGER NOT NULL,
    billing_period  VARCHAR(20),
    set_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, service_type)
);
