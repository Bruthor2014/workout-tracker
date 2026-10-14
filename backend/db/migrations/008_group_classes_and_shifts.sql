-- Aulas de grupo (horário semanal do ginásio) e horários da equipa. Já
-- incluído no schema.sql; isto é só para bases de dados criadas antes.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/008_group_classes_and_shifts.sql

-- Uma aula/palestra/evento que se repete todas as semanas no mesmo dia e
-- hora. O CEO (gym_owner) cria/edita/remove e atribui o responsável
-- (instructor_id; NULL = vaga, qualquer PT/nutricionista se pode propor).
-- O responsável pode pedir substituição (substitute_requested) e outro
-- membro da equipa fica com a aula. audience 'everyone' = para todo o
-- ginásio (membros e equipa), ex: uma palestra de nutrição.
CREATE TABLE IF NOT EXISTS group_classes (
    id                    SERIAL PRIMARY KEY,
    gym_id                INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    title                 VARCHAR(120) NOT NULL,
    kind                  VARCHAR(20) NOT NULL DEFAULT 'class' CHECK (kind IN ('class', 'talk', 'event')),
    weekday               SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7), -- 1 = segunda ... 7 = domingo
    start_time            TIME NOT NULL,
    end_time              TIME NOT NULL,
    room                  VARCHAR(80),
    capacity              INTEGER CHECK (capacity IS NULL OR capacity > 0),
    instructor_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    audience              VARCHAR(20) NOT NULL DEFAULT 'members' CHECK (audience IN ('members', 'everyone')),
    description           TEXT,
    substitute_requested  BOOLEAN NOT NULL DEFAULT false,
    substitute_reason     TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_group_classes_gym ON group_classes(gym_id, weekday, start_time);

-- Turnos semanais de cada membro da equipa, atribuídos pelo CEO (sala de
-- musculação, aula, receção, avaliações...).
CREATE TABLE IF NOT EXISTS staff_shifts (
    id          SERIAL PRIMARY KEY,
    gym_id      INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    staff_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    activity    VARCHAR(20) NOT NULL CHECK (activity IN ('floor', 'class', 'reception', 'assessments', 'admin', 'other')),
    location    VARCHAR(80),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff ON staff_shifts(staff_id, weekday, start_time);
