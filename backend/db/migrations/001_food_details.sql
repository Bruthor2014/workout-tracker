-- Detalhes de cada alimento num plano de nutrição: foto (carregada pelo
-- utilizador ou do Open Food Facts), marca, código de barras e valores
-- nutricionais por 100 g. Já incluído no schema.sql; isto é só para bases de
-- dados criadas antes desta alteração.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/001_food_details.sql
ALTER TABLE meal_option_items
    ADD COLUMN IF NOT EXISTS brand         VARCHAR(150),
    ADD COLUMN IF NOT EXISTS image_url     TEXT,
    ADD COLUMN IF NOT EXISTS off_code      VARCHAR(32),
    ADD COLUMN IF NOT EXISTS kcal_100g     NUMERIC(7,2),
    ADD COLUMN IF NOT EXISTS protein_100g  NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS carbs_100g    NUMERIC(6,2),
    ADD COLUMN IF NOT EXISTS fat_100g      NUMERIC(6,2);
