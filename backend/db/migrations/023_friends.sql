-- Sistema de amigos: cada utilizador tem um código próprio para partilhar
-- (distinto do invite_code de staff/ginásio, que serve para onboarding de
-- clientes). Seguir é direto, sem aprovação, e funciona entre ginásios
-- diferentes (follower_id/followee_id não estão presos a um gym_id).
ALTER TABLE users ADD COLUMN IF NOT EXISTS friend_code VARCHAR(10) UNIQUE;

CREATE TABLE IF NOT EXISTS friendships (
    id           SERIAL PRIMARY KEY,
    follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_follower ON friendships(follower_id);
CREATE INDEX IF NOT EXISTS idx_friendships_followee ON friendships(followee_id);
