-- 025: preço de cada serviço (ginásio, PT, nutrição), por agora um valor
-- fixo por ginásio — NÃO varia por membro/plano ainda. Isso é uma
-- limitação conhecida (ver PROGRESS.txt): no mundo real diferentes membros
-- podem ter preços diferentes consoante o plano que negociaram, mas essa
-- granularidade fica para rever mais tarde.
CREATE TABLE IF NOT EXISTS gym_service_prices (
    id              SERIAL PRIMARY KEY,
    gym_id          INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    service_type    service_type NOT NULL,
    price_cents     INTEGER NOT NULL,
    billing_period  VARCHAR(20) NOT NULL DEFAULT 'monthly',
    UNIQUE (gym_id, service_type)
);

-- Valores de arranque para os ginásios já existentes.
INSERT INTO gym_service_prices (gym_id, service_type, price_cents, billing_period)
SELECT g.id, s.service_type, s.price_cents, 'monthly'
  FROM gyms g
 CROSS JOIN (VALUES
    ('gym_membership'::service_type, 3500),
    ('personal_training'::service_type, 4500),
    ('nutrition_plan'::service_type, 2500)
 ) AS s(service_type, price_cents)
ON CONFLICT (gym_id, service_type) DO NOTHING;
