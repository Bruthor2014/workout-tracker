-- Já incluído no schema.sql; isto é só para bases de dados criadas antes.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/011_client_sessions.sql

-- Sessões semanais de um PT (ou consultas de um nutricionista) com um
-- cliente seu. Os turnos, as aulas e o gerador de horários não podem
-- coincidir com estas horas (ver utils/staffBusy.js).
CREATE TABLE IF NOT EXISTS client_sessions (
    id          SERIAL PRIMARY KEY,
    gym_id      INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    staff_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    member_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    weekday     SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_client_sessions_staff ON client_sessions(staff_id, weekday, start_time);

-- "Sala de musculação" passa a chamar-se só "Sala".
UPDATE staff_shifts SET location = 'Sala' WHERE location = 'Sala de musculação';
