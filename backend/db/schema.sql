-- Workout Tracker — schema Fase 1
-- Multi-tenant (vários ginásios), preparado para Fase 2 (admins) e Fase 3 (progresso)
-- Ver explicação das decisões de design na documentação do projeto.

-- Ginásios (multi-tenant desde o início)
CREATE TABLE gyms (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Utilizadores
-- 'admin' é reservado para administradores da PLATAFORMA (a app em si, não
-- um ginásio específico) — ainda sem funcionalidade própria construída,
-- só reservado para não ser ocupado pelo significado de gestor de ginásio.
-- 'gym_owner' é quem gere UM ginásio (membros, staff, subscrições) — este é
-- o role que "admin" costumava significar neste projeto antes desta
-- separação (ver [[project_workout_tracker]] para o histórico). 'personal_trainer'
-- cria e atribui planos de treino; 'nutritionist' idem para planos
-- alimentares; 'intern' é staff em formação/supervisionado; 'receptionist'
-- faz registo/gestão de membros e check-ins.
CREATE TYPE user_role AS ENUM (
    'member',
    'admin',
    'gym_owner',
    'personal_trainer',
    'nutritionist',
    'intern',
    'receptionist'
);

CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    gym_id         INTEGER NOT NULL REFERENCES gyms(id),
    name           VARCHAR(150) NOT NULL,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    role           user_role NOT NULL DEFAULT 'member',
    avatar_url     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscrições de serviços de um membro (PT / plano de nutrição / a própria
-- inscrição no ginásio). Isto NÃO é um "role" porque um membro pode ter
-- zero, uma ou várias subscrições ativas ao mesmo tempo (ex: PT + nutrição
-- em simultâneo), cada uma com o seu próprio staff atribuído e datas de
-- início/fim. "role" em `users` responde a "que tipo de conta é esta"; esta
-- tabela responde a "que serviços este membro está a pagar agora".
-- 'gym_membership' é a inscrição geral no ginásio (ativada por
-- rececionista/gym_owner) — só com esta ativa é que um membro conta como
-- parte ativa do ginásio; não tem `assigned_staff_id` com sentido (não há
-- "staff atribuído" a uma simples inscrição).
CREATE TYPE service_type AS ENUM ('personal_training', 'nutrition_plan', 'gym_membership');

CREATE TABLE member_subscriptions (
    id                 SERIAL PRIMARY KEY,
    member_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_type       service_type NOT NULL,
    -- staff atribuído (ex: qual PT ou nutricionista); a app deve validar que
    -- o role deste user corresponde ao service_type — a BD não o garante.
    assigned_staff_id  INTEGER REFERENCES users(id),
    started_at         DATE NOT NULL DEFAULT CURRENT_DATE,
    ended_at           DATE,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Impede duas subscrições ativas do mesmo tipo para o mesmo membro
CREATE UNIQUE INDEX idx_one_active_subscription_per_type
    ON member_subscriptions(member_id, service_type)
    WHERE is_active;

-- Catálogo de exercícios (por ginásio, não global)
CREATE TABLE exercises (
    id            SERIAL PRIMARY KEY,
    gym_id        INTEGER NOT NULL REFERENCES gyms(id),
    name          VARCHAR(150) NOT NULL,
    muscle_group  VARCHAR(100),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Planos de treino
CREATE TABLE workout_plans (
    id           SERIAL PRIMARY KEY,
    member_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by   INTEGER NOT NULL REFERENCES users(id),
    name         VARCHAR(150) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dias dentro de um plano (ex: "Segunda - Costas e Bíceps"), para planos
-- com splits em vários dias, não uma lista só de exercícios.
CREATE TABLE plan_days (
    id           SERIAL PRIMARY KEY,
    plan_id      INTEGER NOT NULL REFERENCES workout_plans(id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    order_index  INTEGER NOT NULL DEFAULT 0
);

-- Exercícios dentro de um dia de um plano (template: o que deve ser feito)
CREATE TABLE plan_exercises (
    id           SERIAL PRIMARY KEY,
    plan_day_id  INTEGER NOT NULL REFERENCES plan_days(id) ON DELETE CASCADE,
    exercise_id  INTEGER NOT NULL REFERENCES exercises(id),
    order_index  INTEGER NOT NULL DEFAULT 0,
    target_sets  INTEGER,
    target_reps  INTEGER,
    target_load  NUMERIC(6,2),
    notes        TEXT
);

-- Sessões de treino (um treino/visita concreta, numa data)
CREATE TABLE workout_sessions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id       INTEGER REFERENCES workout_plans(id),
    plan_day_id   INTEGER REFERENCES plan_days(id),
    title         VARCHAR(150),
    performed_at  DATE NOT NULL DEFAULT CURRENT_DATE,
    -- started_at/ended_at só ficam preenchidos quando o treino é feito com
    -- o cronómetro ("Iniciar treino"); um registo manual/retroativo fica a
    -- NULL nos dois — duração calcula-se a partir deles quando existirem.
    started_at    TIMESTAMPTZ,
    ended_at      TIMESTAMPTZ,
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Séries realmente feitas (o que aconteceu, não o planeado)
CREATE TABLE set_logs (
    id                 SERIAL PRIMARY KEY,
    session_id         INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    exercise_id        INTEGER NOT NULL REFERENCES exercises(id),
    plan_exercise_id   INTEGER REFERENCES plan_exercises(id),
    set_number         INTEGER NOT NULL,
    reps               INTEGER NOT NULL,
    weight             NUMERIC(6,2),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registos corporais de um membro (peso e composição corporal), para o
-- gráfico de evolução no perfil. Só staff (PT/admin/nutricionista) regista
-- — por isso separa-se "de quem é a medição" (member_id) de "quem a fez"
-- (recorded_by), tal como member_id/created_by em workout_plans.
CREATE TABLE body_metrics (
    id               SERIAL PRIMARY KEY,
    member_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_by      INTEGER REFERENCES users(id),
    weight_kg        NUMERIC(5,2) NOT NULL,
    body_fat_pct     NUMERIC(4,2),
    lean_mass_kg     NUMERIC(5,2),
    muscle_mass_kg   NUMERIC(5,2),
    bone_mass_kg     NUMERIC(5,2),
    body_water_pct   NUMERIC(4,2),
    recorded_at      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Perímetros corporais (cintura, braço, etc.) — tabela à parte porque quais
-- se medem varia por ginásio/PT; measurement_type é texto livre em vez de
-- colunas fixas, para não obrigar todos os ginásios às mesmas medidas.
CREATE TABLE body_measurements (
    id                SERIAL PRIMARY KEY,
    body_metric_id    INTEGER NOT NULL REFERENCES body_metrics(id) ON DELETE CASCADE,
    measurement_type  VARCHAR(50) NOT NULL,
    value_cm          NUMERIC(5,2) NOT NULL
);

-- Planos de nutrição, com refeições (slots, nome livre — "Pequeno-almoço",
-- "Lanche da manhã", etc.) e várias opções possíveis por refeição.
CREATE TABLE nutrition_plans (
    id           SERIAL PRIMARY KEY,
    member_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by   INTEGER REFERENCES users(id),
    name         VARCHAR(150) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE meal_slots (
    id                  SERIAL PRIMARY KEY,
    nutrition_plan_id   INTEGER NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
    name                VARCHAR(100) NOT NULL,
    order_index         INTEGER NOT NULL DEFAULT 0
);

-- Mais que uma opção por refeição (ex: opção A ou opção B para o
-- pequeno-almoço) — o membro escolhe qual seguir num dado dia. description
-- fica só como rótulo opcional; os alimentos em si vivem em
-- meal_option_items, para dar quantidade a cada um individualmente.
CREATE TABLE meal_options (
    id             SERIAL PRIMARY KEY,
    meal_slot_id   INTEGER NOT NULL REFERENCES meal_slots(id) ON DELETE CASCADE,
    description    TEXT,
    order_index    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE meal_option_items (
    id               SERIAL PRIMARY KEY,
    meal_option_id   INTEGER NOT NULL REFERENCES meal_options(id) ON DELETE CASCADE,
    food_name        VARCHAR(150) NOT NULL,
    quantity         VARCHAR(50),
    order_index      INTEGER NOT NULL DEFAULT 0
);

-- Mensagens diretas entre dois utilizadores do mesmo ginásio (membro <->
-- staff, ou staff <-> staff). Uma "conversa" é só o conjunto de mensagens
-- entre dois ids — não há tabela de conversas à parte.
CREATE TABLE messages (
    id             SERIAL PRIMARY KEY,
    sender_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body           TEXT NOT NULL,
    read_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices úteis para as queries de evolução
CREATE INDEX idx_sessions_user_date ON workout_sessions(user_id, performed_at);
CREATE INDEX idx_set_logs_session ON set_logs(session_id);
CREATE INDEX idx_set_logs_exercise ON set_logs(exercise_id);
CREATE INDEX idx_body_metrics_member_date ON body_metrics(member_id, recorded_at);
CREATE INDEX idx_body_measurements_metric ON body_measurements(body_metric_id);
CREATE INDEX idx_plan_days_plan ON plan_days(plan_id);
CREATE INDEX idx_plan_exercises_day ON plan_exercises(plan_day_id);
CREATE INDEX idx_meal_slots_plan ON meal_slots(nutrition_plan_id);
CREATE INDEX idx_meal_options_slot ON meal_options(meal_slot_id);
CREATE INDEX idx_meal_option_items_option ON meal_option_items(meal_option_id);
CREATE INDEX idx_messages_sender ON messages(sender_id, created_at);
CREATE INDEX idx_messages_recipient ON messages(recipient_id, created_at);
