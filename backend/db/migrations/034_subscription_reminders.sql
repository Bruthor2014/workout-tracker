-- psql -U postgres -d workout_tracker -f backend/db/migrations/034_subscription_reminders.sql

-- Guarda PARA QUE paid_until já foi enviado um lembrete de renovação, não
-- só "se já foi" — assim, quando paid_until avançar (renovação futura), o
-- valor antigo deixa de bater certo e o lembrete volta a poder disparar
-- para o novo ciclo, sem precisar de limpar nada manualmente.
ALTER TABLE member_subscriptions
    ADD COLUMN IF NOT EXISTS reminder_sent_for DATE;
