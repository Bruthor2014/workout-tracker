-- Equipamento usado no exercício (filtro no seletor — ver ExercisePicker.jsx),
-- opcional: exercícios antigos ficam sem equipamento definido até serem
-- recriados/editados, não se inventa um valor.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment VARCHAR(20)
    CHECK (equipment IN ('barra', 'halteres', 'cabo', 'maquina', 'peso_corporal', 'kettlebell', 'elastico', 'outro'));

-- Favoritos (marcador no seletor de exercícios) — por utilizador, funciona
-- tanto no catálogo partilhado como nos exercícios pessoais de qualquer
-- pessoa que os consiga ver.
CREATE TABLE exercise_favorites (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, exercise_id)
);
CREATE INDEX idx_exercise_favorites_user ON exercise_favorites(user_id);
