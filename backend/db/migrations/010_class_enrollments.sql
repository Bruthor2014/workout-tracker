-- Já incluído no schema.sql; isto é só para bases de dados criadas antes.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/010_class_enrollments.sql

-- Inscrições nas aulas de grupo. Cada aula repete-se todas as semanas: a
-- inscrição é para uma data concreta (class_date). Se até cancel_notice_minutes
-- antes do início não houver min_participants inscritos (ou não houver
-- responsável), a aula dessa data é cancelada automaticamente e os inscritos
-- recebem uma mensagem (ver services/classChecker.js).
ALTER TABLE group_classes
    ADD COLUMN IF NOT EXISTS min_participants INTEGER NOT NULL DEFAULT 3 CHECK (min_participants >= 0),
    ADD COLUMN IF NOT EXISTS cancel_notice_minutes INTEGER NOT NULL DEFAULT 30 CHECK (cancel_notice_minutes BETWEEN 0 AND 1440);

CREATE TABLE IF NOT EXISTS class_enrollments (
    id          SERIAL PRIMARY KEY,
    class_id    INTEGER NOT NULL REFERENCES group_classes(id) ON DELETE CASCADE,
    member_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, member_id, class_date)
);

-- Aulas de uma data concreta que foram canceladas (e porquê).
CREATE TABLE IF NOT EXISTS class_cancellations (
    id          SERIAL PRIMARY KEY,
    class_id    INTEGER NOT NULL REFERENCES group_classes(id) ON DELETE CASCADE,
    class_date  DATE NOT NULL,
    reason      VARCHAR(20) NOT NULL CHECK (reason IN ('not_enough', 'no_instructor')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, class_date)
);
