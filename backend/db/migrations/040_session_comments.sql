-- Comentários num treino de um amigo no feed (ver session_reactions em
-- 039_session_photo_reactions.sql para o 👏 — isto é o texto).
CREATE TABLE session_comments (
    id          SERIAL PRIMARY KEY,
    session_id  INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_comments_session ON session_comments(session_id, created_at);
