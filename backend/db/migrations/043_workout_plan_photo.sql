-- Foto de capa do plano de treino (opcional), editável separadamente do
-- nome/descrição (ver PATCH /plans/:id/info em planController.js) — a
-- edição do plano deixou de reescrever os dias inteiros, só nome/descrição/
-- foto; dias geram-se/editam-se um a um (POST/PUT .../days).
ALTER TABLE workout_plans ADD COLUMN IF NOT EXISTS photo_url TEXT;
