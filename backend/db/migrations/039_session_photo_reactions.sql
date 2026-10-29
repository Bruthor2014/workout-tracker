-- Foto opcional do treino (banner, ver LogWorkoutPage.jsx) e reações (👏) de
-- amigos no feed — ambos pedidos explicitamente: "nao consigo ver a
-- fotografia que publicou... nao consigo dar like".
ALTER TABLE workout_sessions ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE TABLE session_reactions (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, user_id)
);
CREATE INDEX idx_session_reactions_session ON session_reactions(session_id);
