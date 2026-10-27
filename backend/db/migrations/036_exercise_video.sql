-- psql -U postgres -d workout_tracker -f backend/db/migrations/036_exercise_video.sql

-- Link de vídeo de execução (ex: YouTube), opcional. Só a parte técnica —
-- preencher os ~200 exercícios do catálogo é trabalho de conteúdo, feito
-- aos poucos; exercícios pessoais já podem ter o link desde já, pelo
-- próprio formulário de criar exercício (ver ExercisePicker.jsx).
ALTER TABLE exercises
    ADD COLUMN IF NOT EXISTS video_url TEXT;
