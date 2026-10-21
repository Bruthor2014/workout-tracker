-- Ironbound — schema Fase 1
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
    assigned_staff_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
-- image_url aponta para uma imagem ilustrativa do exercício (ex: a API
-- pública da wger.de, wger.de/api/v2/exerciseimage/) — não é obrigatório;
-- o picker de exercícios no frontend usa um pictograma por grupo muscular
-- como alternativa quando não há imagem.
CREATE TABLE exercises (
    id            SERIAL PRIMARY KEY,
    gym_id        INTEGER NOT NULL REFERENCES gyms(id),
    name          VARCHAR(150) NOT NULL,
    muscle_group  VARCHAR(100),
    image_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Planos de treino
CREATE TABLE workout_plans (
    id           SERIAL PRIMARY KEY,
    member_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- NULL = criado por alguém que já saiu do ginásio (ver 009_remove_people.sql)
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    -- Máximo quando as reps alvo são um intervalo (ex: 8-12 -> 8 e 12);
    -- NULL quando é um número só.
    target_reps_max INTEGER,
    target_load  NUMERIC(6,2),
    notes        TEXT,
    set_type     VARCHAR(20) NOT NULL DEFAULT 'normal'
                 CHECK (set_type IN ('normal', 'drop', 'rest_pause', 'cluster', 'superset', 'pyramid', 'failure'))
);

-- Sessões de treino (um treino/visita concreta, numa data)
CREATE TABLE workout_sessions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id       INTEGER REFERENCES workout_plans(id),
    plan_day_id   INTEGER REFERENCES plan_days(id) ON DELETE SET NULL,
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
    plan_exercise_id   INTEGER REFERENCES plan_exercises(id) ON DELETE SET NULL,
    set_number         INTEGER NOT NULL,
    reps               INTEGER NOT NULL,
    weight             NUMERIC(6,2),
    -- Técnica usada (ver frontend/src/utils/setTypes.js): normal, drop set,
    -- rest-pause, cluster, super-set, pirâmide ou até à falha.
    set_type           VARCHAR(20) NOT NULL DEFAULT 'normal'
                       CHECK (set_type IN ('normal', 'drop', 'rest_pause', 'cluster', 'superset', 'pyramid', 'failure')),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Registos corporais de um membro (peso e composição corporal), para o
-- gráfico de evolução no perfil. Só staff (PT/admin/nutricionista) regista
-- — por isso separa-se "de quem é a medição" (member_id) de "quem a fez"
-- (recorded_by), tal como member_id/created_by em workout_plans.
CREATE TABLE body_metrics (
    id               SERIAL PRIMARY KEY,
    member_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recorded_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    created_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
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
    order_index      INTEGER NOT NULL DEFAULT 0,
    -- Opcionais: foto (upload próprio ou do Open Food Facts), marca, código
    -- de barras do Open Food Facts e valores nutricionais por 100 g.
    brand            VARCHAR(150),
    image_url        TEXT,
    off_code         VARCHAR(32),
    kcal_100g        NUMERIC(7,2),
    protein_100g     NUMERIC(6,2),
    carbs_100g       NUMERIC(6,2),
    fat_100g         NUMERIC(6,2)
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

-- Uma aula/palestra/evento que se repete todas as semanas no mesmo dia e
-- hora. O CEO (gym_owner) cria/edita/remove e atribui o responsável
-- (instructor_id; NULL = vaga, qualquer PT/nutricionista se pode propor).
-- O responsável pode pedir substituição (substitute_requested) e outro
-- membro da equipa fica com a aula. audience 'everyone' = para todo o
-- ginásio (membros e equipa), ex: uma palestra de nutrição.
CREATE TABLE group_classes (
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
    -- Mínimo de inscritos e com quanto tempo de antecedência se decide
    -- cancelar (ver class_enrollments e services/classChecker.js).
    min_participants      INTEGER NOT NULL DEFAULT 3 CHECK (min_participants >= 0),
    cancel_notice_minutes INTEGER NOT NULL DEFAULT 30 CHECK (cancel_notice_minutes BETWEEN 0 AND 1440),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (end_time > start_time)
);
CREATE INDEX idx_group_classes_gym ON group_classes(gym_id, weekday, start_time);

-- Inscrições nas aulas (uma por membro e data) e aulas canceladas por data.
CREATE TABLE class_enrollments (
    id          SERIAL PRIMARY KEY,
    class_id    INTEGER NOT NULL REFERENCES group_classes(id) ON DELETE CASCADE,
    member_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    class_date  DATE NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, member_id, class_date)
);

-- Aulas de uma data concreta que foram canceladas (e porquê).
CREATE TABLE class_cancellations (
    id          SERIAL PRIMARY KEY,
    class_id    INTEGER NOT NULL REFERENCES group_classes(id) ON DELETE CASCADE,
    class_date  DATE NOT NULL,
    reason      VARCHAR(20) NOT NULL CHECK (reason IN ('not_enough', 'no_instructor')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_id, class_date)
);

-- Turnos semanais de cada membro da equipa, atribuídos pelo CEO (sala de
-- musculação, aula, receção, avaliações...).
CREATE TABLE staff_shifts (
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
CREATE INDEX idx_staff_shifts_staff ON staff_shifts(staff_id, weekday, start_time);

-- Sessões semanais de um PT (ou consultas de um nutricionista) com um
-- cliente seu. Os turnos, as aulas e o gerador de horários não podem
-- coincidir com estas horas (ver utils/staffBusy.js).
CREATE TABLE client_sessions (
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
CREATE INDEX idx_client_sessions_staff ON client_sessions(staff_id, weekday, start_time);

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

-- Ginásio de exemplo (id 1) — tem de existir antes do catálogo abaixo, que o
-- referencia, e é o DEFAULT_GYM_ID usado pelo registo (ver backend/.env).
INSERT INTO gyms (name) VALUES ('Ginásio Demo');

-- Catálogo inicial de exercícios para o ginásio de exemplo (gym_id 1) — dá
-- ao picker de exercícios (filtro por grupo muscular + imagem) algo com que
-- trabalhar logo de início, em vez de uma tabela vazia. As imagens são
-- miniaturas WebP 480x320 (~16 KB cada) em frontend/public/exercises/,
-- servidas pela própria app. Foram geradas a partir das fotos do
-- free-exercise-db (github.com/yuhonas/free-exercise-db, domínio público),
-- todas no mesmo estilo; cada exercício lá tem duas fotos (início/fim do
-- movimento) e usou-se a que o mostra de forma mais reconhecível. Ajustar/
-- remover consoante o ginásio real.
INSERT INTO exercises (gym_id, name, muscle_group, image_url) VALUES
(1, 'Supino Plano', 'Peito', '/exercises/supino-plano.webp'),
(1, 'Supino Inclinado', 'Peito', '/exercises/supino-inclinado.webp'),
(1, 'Supino Declinado', 'Peito', '/exercises/supino-declinado.webp'),
(1, 'Crucifixo', 'Peito', '/exercises/crucifixo.webp'),
(1, 'Peck Deck', 'Peito', '/exercises/peck-deck.webp'),
(1, 'Flexões', 'Peito', '/exercises/flexoes.webp'),
(1, 'Remada Curvada', 'Costas', '/exercises/remada-curvada.webp'),
(1, 'Puxada Alta', 'Costas', '/exercises/puxada-alta.webp'),
(1, 'Remada Baixa', 'Costas', '/exercises/remada-baixa.webp'),
(1, 'Levantamento Terra', 'Costas', '/exercises/levantamento-terra.webp'),
(1, 'Puxada Pegada Fechada', 'Costas', '/exercises/puxada-pegada-fechada.webp'),
(1, 'Agachamento', 'Pernas', '/exercises/agachamento.webp'),
(1, 'Leg Press', 'Pernas', '/exercises/leg-press.webp'),
(1, 'Extensão de Pernas', 'Pernas', '/exercises/extensao-de-pernas.webp'),
(1, 'Flexão de Pernas', 'Pernas', '/exercises/flexao-de-pernas.webp'),
(1, 'Afundo', 'Pernas', '/exercises/afundo.webp'),
(1, 'Agachamento Búlgaro', 'Pernas', '/exercises/agachamento-bulgaro.webp'),
(1, 'Desenvolvimento Militar', 'Ombros', '/exercises/desenvolvimento-militar.webp'),
(1, 'Elevação Lateral', 'Ombros', '/exercises/elevacao-lateral.webp'),
(1, 'Elevação Frontal', 'Ombros', '/exercises/elevacao-frontal.webp'),
(1, 'Remada Alta', 'Ombros', '/exercises/remada-alta.webp'),
(1, 'Rosca Direta', 'Bíceps', '/exercises/rosca-direta.webp'),
(1, 'Rosca Alternada', 'Bíceps', '/exercises/rosca-alternada.webp'),
(1, 'Rosca Martelo', 'Bíceps', '/exercises/rosca-martelo.webp'),
(1, 'Rosca Scott', 'Bíceps', '/exercises/rosca-scott.webp'),
(1, 'Tríceps Corda', 'Tríceps', '/exercises/triceps-corda.webp'),
(1, 'Tríceps Testa', 'Tríceps', '/exercises/triceps-testa.webp'),
(1, 'Mergulho em Paralelas', 'Tríceps', '/exercises/mergulho-em-paralelas.webp'),
(1, 'Prancha', 'Abdominais', '/exercises/prancha.webp'),
(1, 'Abdominal Reto', 'Abdominais', '/exercises/abdominal-reto.webp'),
(1, 'Abdominal Bicicleta', 'Abdominais', '/exercises/abdominal-bicicleta.webp'),
(1, 'Elevação de Pernas', 'Abdominais', '/exercises/elevacao-de-pernas.webp'),
(1, 'Hip Thrust', 'Glúteos', '/exercises/hip-thrust.webp'),
(1, 'Elevação Pélvica', 'Glúteos', '/exercises/elevacao-pelvica.webp'),
(1, 'Stiff', 'Glúteos', '/exercises/stiff.webp');

-- Variações e mais exercícios por grupo muscular (barra, halteres, máquina,
-- cabo, peso corporal) — mesma origem e formato das imagens acima.
INSERT INTO exercises (gym_id, name, muscle_group, image_url) VALUES
(1, 'Supino Plano com Halteres', 'Peito', '/exercises/supino-plano-com-halteres.webp'),
(1, 'Supino Inclinado com Halteres', 'Peito', '/exercises/supino-inclinado-com-halteres.webp'),
(1, 'Supino Declinado com Halteres', 'Peito', '/exercises/supino-declinado-com-halteres.webp'),
(1, 'Supino Pegada Larga', 'Peito', '/exercises/supino-pegada-larga.webp'),
(1, 'Supino na Máquina', 'Peito', '/exercises/supino-na-maquina.webp'),
(1, 'Supino Inclinado no Smith', 'Peito', '/exercises/supino-inclinado-no-smith.webp'),
(1, 'Crucifixo Inclinado', 'Peito', '/exercises/crucifixo-inclinado.webp'),
(1, 'Crucifixo Declinado', 'Peito', '/exercises/crucifixo-declinado.webp'),
(1, 'Crossover no Cabo', 'Peito', '/exercises/crossover-no-cabo.webp'),
(1, 'Crucifixo no Cabo Baixo', 'Peito', '/exercises/crucifixo-no-cabo-baixo.webp'),
(1, 'Pullover com Halter', 'Peito', '/exercises/pullover-com-halter.webp'),
(1, 'Flexões Inclinadas', 'Peito', '/exercises/flexoes-inclinadas.webp'),
(1, 'Flexões Declinadas', 'Peito', '/exercises/flexoes-declinadas.webp'),
(1, 'Mergulho para Peito', 'Peito', '/exercises/mergulho-para-peito.webp'),
(1, 'Barra Fixa', 'Costas', '/exercises/barra-fixa.webp'),
(1, 'Barra Fixa Supinada', 'Costas', '/exercises/barra-fixa-supinada.webp'),
(1, 'Puxada Unilateral', 'Costas', '/exercises/puxada-unilateral.webp'),
(1, 'Puxada com Braços Estendidos', 'Costas', '/exercises/puxada-com-bracos-estendidos.webp'),
(1, 'Remada Unilateral com Halter', 'Costas', '/exercises/remada-unilateral-com-halter.webp'),
(1, 'Remada Cavalinho', 'Costas', '/exercises/remada-cavalinho.webp'),
(1, 'Remada Curvada Supinada', 'Costas', '/exercises/remada-curvada-supinada.webp'),
(1, 'Remada Invertida', 'Costas', '/exercises/remada-invertida.webp'),
(1, 'Remada Unilateral no Cabo', 'Costas', '/exercises/remada-unilateral-no-cabo.webp'),
(1, 'Hiperextensão Lombar', 'Costas', '/exercises/hiperextensao-lombar.webp'),
(1, 'Encolhimento com Barra', 'Costas', '/exercises/encolhimento-com-barra.webp'),
(1, 'Encolhimento com Halteres', 'Costas', '/exercises/encolhimento-com-halteres.webp'),
(1, 'Good Morning', 'Costas', '/exercises/good-morning.webp'),
(1, 'Levantamento Terra Sumo', 'Costas', '/exercises/levantamento-terra-sumo.webp'),
(1, 'Agachamento Frontal', 'Pernas', '/exercises/agachamento-frontal.webp'),
(1, 'Agachamento Hack', 'Pernas', '/exercises/agachamento-hack.webp'),
(1, 'Agachamento Goblet', 'Pernas', '/exercises/agachamento-goblet.webp'),
(1, 'Agachamento no Smith', 'Pernas', '/exercises/agachamento-no-smith.webp'),
(1, 'Agachamento com Peso Corporal', 'Pernas', '/exercises/agachamento-com-peso-corporal.webp'),
(1, 'Afundo com Barra', 'Pernas', '/exercises/afundo-com-barra.webp'),
(1, 'Afundo Caminhando', 'Pernas', '/exercises/afundo-caminhando.webp'),
(1, 'Afundo Invertido', 'Pernas', '/exercises/afundo-invertido.webp'),
(1, 'Subida ao Banco', 'Pernas', '/exercises/subida-ao-banco.webp'),
(1, 'Leg Press Pés Juntos', 'Pernas', '/exercises/leg-press-pes-juntos.webp'),
(1, 'Flexão de Pernas Sentado', 'Pernas', '/exercises/flexao-de-pernas-sentado.webp'),
(1, 'Flexão de Pernas em Pé', 'Pernas', '/exercises/flexao-de-pernas-em-pe.webp'),
(1, 'Extensão de Pernas Unilateral', 'Pernas', '/exercises/extensao-de-pernas-unilateral.webp'),
(1, 'Cadeira Adutora', 'Pernas', '/exercises/cadeira-adutora.webp'),
(1, 'Cadeira Abdutora', 'Pernas', '/exercises/cadeira-abdutora.webp'),
(1, 'Gémeos em Pé', 'Pernas', '/exercises/gemeos-em-pe.webp'),
(1, 'Gémeos Sentado', 'Pernas', '/exercises/gemeos-sentado.webp'),
(1, 'Gémeos no Leg Press', 'Pernas', '/exercises/gemeos-no-leg-press.webp'),
(1, 'Desenvolvimento com Halteres', 'Ombros', '/exercises/desenvolvimento-com-halteres.webp'),
(1, 'Arnold Press', 'Ombros', '/exercises/arnold-press.webp'),
(1, 'Desenvolvimento Sentado com Barra', 'Ombros', '/exercises/desenvolvimento-sentado-com-barra.webp'),
(1, 'Desenvolvimento na Máquina', 'Ombros', '/exercises/desenvolvimento-na-maquina.webp'),
(1, 'Elevação Lateral no Cabo', 'Ombros', '/exercises/elevacao-lateral-no-cabo.webp'),
(1, 'Elevação Lateral Sentado', 'Ombros', '/exercises/elevacao-lateral-sentado.webp'),
(1, 'Elevação Frontal com Disco', 'Ombros', '/exercises/elevacao-frontal-com-disco.webp'),
(1, 'Elevação Frontal no Cabo', 'Ombros', '/exercises/elevacao-frontal-no-cabo.webp'),
(1, 'Face Pull', 'Ombros', '/exercises/face-pull.webp'),
(1, 'Crucifixo Invertido', 'Ombros', '/exercises/crucifixo-invertido.webp'),
(1, 'Elevação Posterior Curvado', 'Ombros', '/exercises/elevacao-posterior-curvado.webp'),
(1, 'Remada Alta com Halteres', 'Ombros', '/exercises/remada-alta-com-halteres.webp'),
(1, 'Rosca Concentrada', 'Bíceps', '/exercises/rosca-concentrada.webp'),
(1, 'Rosca no Cabo', 'Bíceps', '/exercises/rosca-no-cabo.webp'),
(1, 'Rosca Inclinada', 'Bíceps', '/exercises/rosca-inclinada.webp'),
(1, 'Rosca com Barra EZ', 'Bíceps', '/exercises/rosca-com-barra-ez.webp'),
(1, 'Rosca Inversa', 'Bíceps', '/exercises/rosca-inversa.webp'),
(1, 'Rosca Martelo no Cabo', 'Bíceps', '/exercises/rosca-martelo-no-cabo.webp'),
(1, 'Rosca Scott na Máquina', 'Bíceps', '/exercises/rosca-scott-na-maquina.webp'),
(1, 'Rosca Spider', 'Bíceps', '/exercises/rosca-spider.webp'),
(1, 'Rosca de Punho', 'Bíceps', '/exercises/rosca-de-punho.webp'),
(1, 'Tríceps na Polia com Barra', 'Tríceps', '/exercises/triceps-na-polia-com-barra.webp'),
(1, 'Tríceps na Polia Pegada Invertida', 'Tríceps', '/exercises/triceps-na-polia-pegada-invertida.webp'),
(1, 'Tríceps Francês', 'Tríceps', '/exercises/triceps-frances.webp'),
(1, 'Tríceps Coice', 'Tríceps', '/exercises/triceps-coice.webp'),
(1, 'Tríceps no Cabo Acima da Cabeça', 'Tríceps', '/exercises/triceps-no-cabo-acima-da-cabeca.webp'),
(1, 'Supino Pegada Fechada', 'Tríceps', '/exercises/supino-pegada-fechada.webp'),
(1, 'Mergulho no Banco', 'Tríceps', '/exercises/mergulho-no-banco.webp'),
(1, 'Flexões Diamante', 'Tríceps', '/exercises/flexoes-diamante.webp'),
(1, 'Prancha Lateral', 'Abdominais', '/exercises/prancha-lateral.webp'),
(1, 'Abdominal na Polia', 'Abdominais', '/exercises/abdominal-na-polia.webp'),
(1, 'Elevação de Pernas Suspenso', 'Abdominais', '/exercises/elevacao-de-pernas-suspenso.webp'),
(1, 'Abdominal Russo', 'Abdominais', '/exercises/abdominal-russo.webp'),
(1, 'Abdominal Invertido', 'Abdominais', '/exercises/abdominal-invertido.webp'),
(1, 'Roda Abdominal', 'Abdominais', '/exercises/roda-abdominal.webp'),
(1, 'Abdominal na Máquina', 'Abdominais', '/exercises/abdominal-na-maquina.webp'),
(1, 'Mountain Climbers', 'Abdominais', '/exercises/mountain-climbers.webp'),
(1, 'Abdominal Oblíquo', 'Abdominais', '/exercises/abdominal-obliquo.webp'),
(1, 'Dead Bug', 'Abdominais', '/exercises/dead-bug.webp'),
(1, 'Levantamento Terra Romeno', 'Glúteos', '/exercises/levantamento-terra-romeno.webp'),
(1, 'Ponte de Glúteos com Barra', 'Glúteos', '/exercises/ponte-de-gluteos-com-barra.webp'),
(1, 'Ponte de Glúteos Unilateral', 'Glúteos', '/exercises/ponte-de-gluteos-unilateral.webp'),
(1, 'Coice na Polia', 'Glúteos', '/exercises/coice-na-polia.webp'),
(1, 'Agachamento Sumo com Halter', 'Glúteos', '/exercises/agachamento-sumo-com-halter.webp'),
(1, 'Coice de Quatro Apoios', 'Glúteos', '/exercises/coice-de-quatro-apoios.webp');

-- Cardio (em reps/carga regista-se minutos e km — ver WorkoutExerciseBlock)
-- e mais variações de bíceps, tríceps e glúteos.
INSERT INTO exercises (gym_id, name, muscle_group, image_url) VALUES
(1, 'Passadeira (Corrida)', 'Cardio', '/exercises/passadeira-corrida.webp'),
(1, 'Passadeira (Jogging)', 'Cardio', '/exercises/passadeira-jogging.webp'),
(1, 'Passadeira (Caminhada)', 'Cardio', '/exercises/passadeira-caminhada.webp'),
(1, 'Bicicleta Estática', 'Cardio', '/exercises/bicicleta-estatica.webp'),
(1, 'Bicicleta Reclinada', 'Cardio', '/exercises/bicicleta-reclinada.webp'),
(1, 'Elíptica', 'Cardio', '/exercises/eliptica.webp'),
(1, 'Remo (Máquina)', 'Cardio', '/exercises/remo-maquina.webp'),
(1, 'Escadas (Stairmaster)', 'Cardio', '/exercises/escadas-stairmaster.webp'),
(1, 'Step Mill', 'Cardio', '/exercises/step-mill.webp'),
(1, 'Saltar à Corda', 'Cardio', '/exercises/saltar-a-corda.webp'),
(1, 'Corrida/Caminhada ao Ar Livre', 'Cardio', '/exercises/corrida-caminhada-ao-ar-livre.webp'),
(1, 'Sprint com Trenó', 'Cardio', '/exercises/sprint-com-treno.webp'),
(1, 'Patinagem', 'Cardio', '/exercises/patinagem.webp'),
(1, 'Rosca Direta com Halteres', 'Bíceps', '/exercises/rosca-direta-com-halteres.webp'),
(1, 'Rosca Sentado com Halteres', 'Bíceps', '/exercises/rosca-sentado-com-halteres.webp'),
(1, 'Rosca Martelo Alternada', 'Bíceps', '/exercises/rosca-martelo-alternada.webp'),
(1, 'Rosca Martelo Cruzada', 'Bíceps', '/exercises/rosca-martelo-cruzada.webp'),
(1, 'Rosca Martelo Inclinada', 'Bíceps', '/exercises/rosca-martelo-inclinada.webp'),
(1, 'Rosca Martelo no Banco Scott', 'Bíceps', '/exercises/rosca-martelo-no-banco-scott.webp'),
(1, 'Rosca Inclinada com Halteres', 'Bíceps', '/exercises/rosca-inclinada-com-halteres.webp'),
(1, 'Rosca Scott Unilateral', 'Bíceps', '/exercises/rosca-scott-unilateral.webp'),
(1, 'Rosca Scott com Halteres', 'Bíceps', '/exercises/rosca-scott-com-halteres.webp'),
(1, 'Rosca Scott no Cabo', 'Bíceps', '/exercises/rosca-scott-no-cabo.webp'),
(1, 'Rosca Scott Inversa', 'Bíceps', '/exercises/rosca-scott-inversa.webp'),
(1, 'Rosca Pegada Fechada', 'Bíceps', '/exercises/rosca-pegada-fechada.webp'),
(1, 'Rosca Pegada Larga', 'Bíceps', '/exercises/rosca-pegada-larga.webp'),
(1, 'Rosca EZ Pegada Fechada', 'Bíceps', '/exercises/rosca-ez-pegada-fechada.webp'),
(1, 'Drag Curl', 'Bíceps', '/exercises/drag-curl.webp'),
(1, 'Rosca Zottman', 'Bíceps', '/exercises/rosca-zottman.webp'),
(1, 'Rosca no Cabo Alto', 'Bíceps', '/exercises/rosca-no-cabo-alto.webp'),
(1, 'Rosca Unilateral no Cabo', 'Bíceps', '/exercises/rosca-unilateral-no-cabo.webp'),
(1, 'Rosca Inversa no Cabo', 'Bíceps', '/exercises/rosca-inversa-no-cabo.webp'),
(1, 'Rosca na Máquina', 'Bíceps', '/exercises/rosca-na-maquina.webp'),
(1, 'Rosca Concentrada em Pé', 'Bíceps', '/exercises/rosca-concentrada-em-pe.webp'),
(1, 'Rosca Inversa com Halteres', 'Bíceps', '/exercises/rosca-inversa-com-halteres.webp'),
(1, 'Tríceps na Polia com Barra V', 'Tríceps', '/exercises/triceps-na-polia-com-barra-v.webp'),
(1, 'Tríceps Unilateral no Cabo', 'Tríceps', '/exercises/triceps-unilateral-no-cabo.webp'),
(1, 'Tríceps Corda Acima da Cabeça', 'Tríceps', '/exercises/triceps-corda-acima-da-cabeca.webp'),
(1, 'Tríceps Deitado no Cabo', 'Tríceps', '/exercises/triceps-deitado-no-cabo.webp'),
(1, 'Tríceps Testa com Halteres', 'Tríceps', '/exercises/triceps-testa-com-halteres.webp'),
(1, 'Tríceps Testa Declinado', 'Tríceps', '/exercises/triceps-testa-declinado.webp'),
(1, 'Tríceps Testa Inclinado', 'Tríceps', '/exercises/triceps-testa-inclinado.webp'),
(1, 'Tríceps Francês com Barra', 'Tríceps', '/exercises/triceps-frances-com-barra.webp'),
(1, 'Tríceps Francês Unilateral', 'Tríceps', '/exercises/triceps-frances-unilateral.webp'),
(1, 'Tríceps Francês Sentado', 'Tríceps', '/exercises/triceps-frances-sentado.webp'),
(1, 'Tate Press', 'Tríceps', '/exercises/tate-press.webp'),
(1, 'JM Press', 'Tríceps', '/exercises/jm-press.webp'),
(1, 'Supino Fechado com Halteres', 'Tríceps', '/exercises/supino-fechado-com-halteres.webp'),
(1, 'Supino Fechado no Smith', 'Tríceps', '/exercises/supino-fechado-no-smith.webp'),
(1, 'Mergulho na Máquina', 'Tríceps', '/exercises/mergulho-na-maquina.webp'),
(1, 'Mergulho no Banco com Peso', 'Tríceps', '/exercises/mergulho-no-banco-com-peso.webp'),
(1, 'Tríceps na Máquina', 'Tríceps', '/exercises/triceps-na-maquina.webp'),
(1, 'Flexões Fechadas Inclinadas', 'Tríceps', '/exercises/flexoes-fechadas-inclinadas.webp'),
(1, 'Hip Thrust no Smith', 'Glúteos', '/exercises/hip-thrust-no-smith.webp'),
(1, 'Pull Through no Cabo', 'Glúteos', '/exercises/pull-through-no-cabo.webp'),
(1, 'Extensão de Anca com Elástico', 'Glúteos', '/exercises/extensao-de-anca-com-elastico.webp'),
(1, 'Ponte de Glúteos com Elástico', 'Glúteos', '/exercises/ponte-de-gluteos-com-elastico.webp'),
(1, 'Ponte de Glúteos na Bola', 'Glúteos', '/exercises/ponte-de-gluteos-na-bola.webp'),
(1, 'Levantamento Terra Unilateral', 'Glúteos', '/exercises/levantamento-terra-unilateral.webp'),
(1, 'Stiff com Halteres', 'Glúteos', '/exercises/stiff-com-halteres.webp'),
(1, 'Stiff no Smith', 'Glúteos', '/exercises/stiff-no-smith.webp'),
(1, 'Kettlebell Swing', 'Glúteos', '/exercises/kettlebell-swing.webp'),
(1, 'Subida ao Banco com Barra', 'Glúteos', '/exercises/subida-ao-banco-com-barra.webp'),
(1, 'Afundo Caminhando com Barra', 'Glúteos', '/exercises/afundo-caminhando-com-barra.webp'),
(1, 'Afundo Elevado', 'Glúteos', '/exercises/afundo-elevado.webp'),
(1, 'Glute Ham Raise', 'Glúteos', '/exercises/glute-ham-raise.webp'),
(1, 'Adução de Anca no Cabo', 'Pernas', '/exercises/aducao-de-anca-no-cabo.webp'),
(1, 'Levantamento Terra com Trap Bar', 'Costas', '/exercises/levantamento-terra-com-trap-bar.webp'),
(1, 'Levantamento Terra no Cabo', 'Costas', '/exercises/levantamento-terra-no-cabo.webp'),
(1, 'Flutter Kicks', 'Abdominais', '/exercises/flutter-kicks.webp'),
(1, 'Elevação de Joelhos nas Paralelas', 'Abdominais', '/exercises/elevacao-de-joelhos-nas-paralelas.webp');
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
-- Reps alvo como intervalo nos planos (ex: 8-12): target_reps passa a ser o
-- mínimo e target_reps_max o máximo (NULL quando é um número só). Já
-- incluído no schema.sql; isto é só para bases de dados criadas antes.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/002_rep_ranges.sql
ALTER TABLE plan_exercises
    ADD COLUMN IF NOT EXISTS target_reps_max INTEGER;
-- Um treino registado a partir de um plano fica ligado ao dia do plano
-- (workout_sessions.plan_day_id). Sem ON DELETE, editar ou apagar esse
-- plano depois disso falhava (as edições recriam os dias). Agora o treino
-- fica, só perde a ligação ao dia. O mesmo para set_logs.plan_exercise_id.
-- Já incluído no schema.sql; isto é só para bases de dados criadas antes.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/003_plan_links_on_delete.sql
ALTER TABLE workout_sessions
    DROP CONSTRAINT IF EXISTS workout_sessions_plan_day_id_fkey,
    ADD CONSTRAINT workout_sessions_plan_day_id_fkey
        FOREIGN KEY (plan_day_id) REFERENCES plan_days(id) ON DELETE SET NULL;

ALTER TABLE set_logs
    DROP CONSTRAINT IF EXISTS set_logs_plan_exercise_id_fkey,
    ADD CONSTRAINT set_logs_plan_exercise_id_fkey
        FOREIGN KEY (plan_exercise_id) REFERENCES plan_exercises(id) ON DELETE SET NULL;
-- Tipo de cada série registada: 'normal' ou 'drop' (drop set — o mesmo
-- exercício seguido, a baixar o peso e a fazer o máximo de reps em cada
-- drop). Já incluído no schema.sql; isto é só para bases de dados criadas
-- antes desta alteração.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/004_set_types.sql
ALTER TABLE set_logs
    ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (set_type IN ('normal', 'drop'));
-- Mais tipos de série além de normal/drop: rest-pause, cluster, super-set,
-- pirâmide e até à falha. Já incluído no schema.sql; isto é só para bases
-- de dados criadas antes desta alteração.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/005_more_set_types.sql
ALTER TABLE set_logs
    DROP CONSTRAINT IF EXISTS set_logs_set_type_check,
    ADD CONSTRAINT set_logs_set_type_check
        CHECK (set_type IN ('normal', 'drop', 'rest_pause', 'cluster', 'superset', 'pyramid', 'failure'));
-- Mais 91 exercícios (variações por grupo muscular) no catálogo do ginásio 1.
-- Já incluído no schema.sql; isto é só para bases de dados criadas antes.
-- As imagens estão em frontend/public/exercises/.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/006_more_exercises.sql
-- Só insere os que ainda não existem no ginásio 1 (pode correr mais que uma vez).
INSERT INTO exercises (gym_id, name, muscle_group, image_url)
SELECT v.gym_id, v.name, v.muscle_group, v.image_url
  FROM (VALUES
(1, 'Supino Plano com Halteres', 'Peito', '/exercises/supino-plano-com-halteres.webp'),
(1, 'Supino Inclinado com Halteres', 'Peito', '/exercises/supino-inclinado-com-halteres.webp'),
(1, 'Supino Declinado com Halteres', 'Peito', '/exercises/supino-declinado-com-halteres.webp'),
(1, 'Supino Pegada Larga', 'Peito', '/exercises/supino-pegada-larga.webp'),
(1, 'Supino na Máquina', 'Peito', '/exercises/supino-na-maquina.webp'),
(1, 'Supino Inclinado no Smith', 'Peito', '/exercises/supino-inclinado-no-smith.webp'),
(1, 'Crucifixo Inclinado', 'Peito', '/exercises/crucifixo-inclinado.webp'),
(1, 'Crucifixo Declinado', 'Peito', '/exercises/crucifixo-declinado.webp'),
(1, 'Crossover no Cabo', 'Peito', '/exercises/crossover-no-cabo.webp'),
(1, 'Crucifixo no Cabo Baixo', 'Peito', '/exercises/crucifixo-no-cabo-baixo.webp'),
(1, 'Pullover com Halter', 'Peito', '/exercises/pullover-com-halter.webp'),
(1, 'Flexões Inclinadas', 'Peito', '/exercises/flexoes-inclinadas.webp'),
(1, 'Flexões Declinadas', 'Peito', '/exercises/flexoes-declinadas.webp'),
(1, 'Mergulho para Peito', 'Peito', '/exercises/mergulho-para-peito.webp'),
(1, 'Barra Fixa', 'Costas', '/exercises/barra-fixa.webp'),
(1, 'Barra Fixa Supinada', 'Costas', '/exercises/barra-fixa-supinada.webp'),
(1, 'Puxada Unilateral', 'Costas', '/exercises/puxada-unilateral.webp'),
(1, 'Puxada com Braços Estendidos', 'Costas', '/exercises/puxada-com-bracos-estendidos.webp'),
(1, 'Remada Unilateral com Halter', 'Costas', '/exercises/remada-unilateral-com-halter.webp'),
(1, 'Remada Cavalinho', 'Costas', '/exercises/remada-cavalinho.webp'),
(1, 'Remada Curvada Supinada', 'Costas', '/exercises/remada-curvada-supinada.webp'),
(1, 'Remada Invertida', 'Costas', '/exercises/remada-invertida.webp'),
(1, 'Remada Unilateral no Cabo', 'Costas', '/exercises/remada-unilateral-no-cabo.webp'),
(1, 'Hiperextensão Lombar', 'Costas', '/exercises/hiperextensao-lombar.webp'),
(1, 'Encolhimento com Barra', 'Costas', '/exercises/encolhimento-com-barra.webp'),
(1, 'Encolhimento com Halteres', 'Costas', '/exercises/encolhimento-com-halteres.webp'),
(1, 'Good Morning', 'Costas', '/exercises/good-morning.webp'),
(1, 'Levantamento Terra Sumo', 'Costas', '/exercises/levantamento-terra-sumo.webp'),
(1, 'Agachamento Frontal', 'Pernas', '/exercises/agachamento-frontal.webp'),
(1, 'Agachamento Hack', 'Pernas', '/exercises/agachamento-hack.webp'),
(1, 'Agachamento Goblet', 'Pernas', '/exercises/agachamento-goblet.webp'),
(1, 'Agachamento no Smith', 'Pernas', '/exercises/agachamento-no-smith.webp'),
(1, 'Agachamento com Peso Corporal', 'Pernas', '/exercises/agachamento-com-peso-corporal.webp'),
(1, 'Afundo com Barra', 'Pernas', '/exercises/afundo-com-barra.webp'),
(1, 'Afundo Caminhando', 'Pernas', '/exercises/afundo-caminhando.webp'),
(1, 'Afundo Invertido', 'Pernas', '/exercises/afundo-invertido.webp'),
(1, 'Subida ao Banco', 'Pernas', '/exercises/subida-ao-banco.webp'),
(1, 'Leg Press Pés Juntos', 'Pernas', '/exercises/leg-press-pes-juntos.webp'),
(1, 'Flexão de Pernas Sentado', 'Pernas', '/exercises/flexao-de-pernas-sentado.webp'),
(1, 'Flexão de Pernas em Pé', 'Pernas', '/exercises/flexao-de-pernas-em-pe.webp'),
(1, 'Extensão de Pernas Unilateral', 'Pernas', '/exercises/extensao-de-pernas-unilateral.webp'),
(1, 'Cadeira Adutora', 'Pernas', '/exercises/cadeira-adutora.webp'),
(1, 'Cadeira Abdutora', 'Pernas', '/exercises/cadeira-abdutora.webp'),
(1, 'Gémeos em Pé', 'Pernas', '/exercises/gemeos-em-pe.webp'),
(1, 'Gémeos Sentado', 'Pernas', '/exercises/gemeos-sentado.webp'),
(1, 'Gémeos no Leg Press', 'Pernas', '/exercises/gemeos-no-leg-press.webp'),
(1, 'Desenvolvimento com Halteres', 'Ombros', '/exercises/desenvolvimento-com-halteres.webp'),
(1, 'Arnold Press', 'Ombros', '/exercises/arnold-press.webp'),
(1, 'Desenvolvimento Sentado com Barra', 'Ombros', '/exercises/desenvolvimento-sentado-com-barra.webp'),
(1, 'Desenvolvimento na Máquina', 'Ombros', '/exercises/desenvolvimento-na-maquina.webp'),
(1, 'Elevação Lateral no Cabo', 'Ombros', '/exercises/elevacao-lateral-no-cabo.webp'),
(1, 'Elevação Lateral Sentado', 'Ombros', '/exercises/elevacao-lateral-sentado.webp'),
(1, 'Elevação Frontal com Disco', 'Ombros', '/exercises/elevacao-frontal-com-disco.webp'),
(1, 'Elevação Frontal no Cabo', 'Ombros', '/exercises/elevacao-frontal-no-cabo.webp'),
(1, 'Face Pull', 'Ombros', '/exercises/face-pull.webp'),
(1, 'Crucifixo Invertido', 'Ombros', '/exercises/crucifixo-invertido.webp'),
(1, 'Elevação Posterior Curvado', 'Ombros', '/exercises/elevacao-posterior-curvado.webp'),
(1, 'Remada Alta com Halteres', 'Ombros', '/exercises/remada-alta-com-halteres.webp'),
(1, 'Rosca Concentrada', 'Bíceps', '/exercises/rosca-concentrada.webp'),
(1, 'Rosca no Cabo', 'Bíceps', '/exercises/rosca-no-cabo.webp'),
(1, 'Rosca Inclinada', 'Bíceps', '/exercises/rosca-inclinada.webp'),
(1, 'Rosca com Barra EZ', 'Bíceps', '/exercises/rosca-com-barra-ez.webp'),
(1, 'Rosca Inversa', 'Bíceps', '/exercises/rosca-inversa.webp'),
(1, 'Rosca Martelo no Cabo', 'Bíceps', '/exercises/rosca-martelo-no-cabo.webp'),
(1, 'Rosca Scott na Máquina', 'Bíceps', '/exercises/rosca-scott-na-maquina.webp'),
(1, 'Rosca Spider', 'Bíceps', '/exercises/rosca-spider.webp'),
(1, 'Rosca de Punho', 'Bíceps', '/exercises/rosca-de-punho.webp'),
(1, 'Tríceps na Polia com Barra', 'Tríceps', '/exercises/triceps-na-polia-com-barra.webp'),
(1, 'Tríceps na Polia Pegada Invertida', 'Tríceps', '/exercises/triceps-na-polia-pegada-invertida.webp'),
(1, 'Tríceps Francês', 'Tríceps', '/exercises/triceps-frances.webp'),
(1, 'Tríceps Coice', 'Tríceps', '/exercises/triceps-coice.webp'),
(1, 'Tríceps no Cabo Acima da Cabeça', 'Tríceps', '/exercises/triceps-no-cabo-acima-da-cabeca.webp'),
(1, 'Supino Pegada Fechada', 'Tríceps', '/exercises/supino-pegada-fechada.webp'),
(1, 'Mergulho no Banco', 'Tríceps', '/exercises/mergulho-no-banco.webp'),
(1, 'Flexões Diamante', 'Tríceps', '/exercises/flexoes-diamante.webp'),
(1, 'Prancha Lateral', 'Abdominais', '/exercises/prancha-lateral.webp'),
(1, 'Abdominal na Polia', 'Abdominais', '/exercises/abdominal-na-polia.webp'),
(1, 'Elevação de Pernas Suspenso', 'Abdominais', '/exercises/elevacao-de-pernas-suspenso.webp'),
(1, 'Abdominal Russo', 'Abdominais', '/exercises/abdominal-russo.webp'),
(1, 'Abdominal Invertido', 'Abdominais', '/exercises/abdominal-invertido.webp'),
(1, 'Roda Abdominal', 'Abdominais', '/exercises/roda-abdominal.webp'),
(1, 'Abdominal na Máquina', 'Abdominais', '/exercises/abdominal-na-maquina.webp'),
(1, 'Mountain Climbers', 'Abdominais', '/exercises/mountain-climbers.webp'),
(1, 'Abdominal Oblíquo', 'Abdominais', '/exercises/abdominal-obliquo.webp'),
(1, 'Dead Bug', 'Abdominais', '/exercises/dead-bug.webp'),
(1, 'Levantamento Terra Romeno', 'Glúteos', '/exercises/levantamento-terra-romeno.webp'),
(1, 'Ponte de Glúteos com Barra', 'Glúteos', '/exercises/ponte-de-gluteos-com-barra.webp'),
(1, 'Ponte de Glúteos Unilateral', 'Glúteos', '/exercises/ponte-de-gluteos-unilateral.webp'),
(1, 'Coice na Polia', 'Glúteos', '/exercises/coice-na-polia.webp'),
(1, 'Agachamento Sumo com Halter', 'Glúteos', '/exercises/agachamento-sumo-com-halter.webp'),
(1, 'Coice de Quatro Apoios', 'Glúteos', '/exercises/coice-de-quatro-apoios.webp')
  ) AS v(gym_id, name, muscle_group, image_url)
 WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.gym_id = v.gym_id AND e.name = v.name);
-- Mais 71 exercícios: grupo Cardio (passadeira, bicicleta, elíptica, remo,
-- escadas, corda...) e mais variações de bíceps, tríceps e glúteos. Já
-- incluído no schema.sql; isto é só para bases de dados criadas antes.
-- Pode correr mais que uma vez (só insere os que ainda não existem).
--   psql -U <user> -d workout_tracker -f backend/db/migrations/007_cardio_and_variations.sql
INSERT INTO exercises (gym_id, name, muscle_group, image_url)
SELECT v.gym_id, v.name, v.muscle_group, v.image_url
  FROM (VALUES
(1, 'Passadeira (Corrida)', 'Cardio', '/exercises/passadeira-corrida.webp'),
(1, 'Passadeira (Jogging)', 'Cardio', '/exercises/passadeira-jogging.webp'),
(1, 'Passadeira (Caminhada)', 'Cardio', '/exercises/passadeira-caminhada.webp'),
(1, 'Bicicleta Estática', 'Cardio', '/exercises/bicicleta-estatica.webp'),
(1, 'Bicicleta Reclinada', 'Cardio', '/exercises/bicicleta-reclinada.webp'),
(1, 'Elíptica', 'Cardio', '/exercises/eliptica.webp'),
(1, 'Remo (Máquina)', 'Cardio', '/exercises/remo-maquina.webp'),
(1, 'Escadas (Stairmaster)', 'Cardio', '/exercises/escadas-stairmaster.webp'),
(1, 'Step Mill', 'Cardio', '/exercises/step-mill.webp'),
(1, 'Saltar à Corda', 'Cardio', '/exercises/saltar-a-corda.webp'),
(1, 'Corrida/Caminhada ao Ar Livre', 'Cardio', '/exercises/corrida-caminhada-ao-ar-livre.webp'),
(1, 'Sprint com Trenó', 'Cardio', '/exercises/sprint-com-treno.webp'),
(1, 'Patinagem', 'Cardio', '/exercises/patinagem.webp'),
(1, 'Rosca Direta com Halteres', 'Bíceps', '/exercises/rosca-direta-com-halteres.webp'),
(1, 'Rosca Sentado com Halteres', 'Bíceps', '/exercises/rosca-sentado-com-halteres.webp'),
(1, 'Rosca Martelo Alternada', 'Bíceps', '/exercises/rosca-martelo-alternada.webp'),
(1, 'Rosca Martelo Cruzada', 'Bíceps', '/exercises/rosca-martelo-cruzada.webp'),
(1, 'Rosca Martelo Inclinada', 'Bíceps', '/exercises/rosca-martelo-inclinada.webp'),
(1, 'Rosca Martelo no Banco Scott', 'Bíceps', '/exercises/rosca-martelo-no-banco-scott.webp'),
(1, 'Rosca Inclinada com Halteres', 'Bíceps', '/exercises/rosca-inclinada-com-halteres.webp'),
(1, 'Rosca Scott Unilateral', 'Bíceps', '/exercises/rosca-scott-unilateral.webp'),
(1, 'Rosca Scott com Halteres', 'Bíceps', '/exercises/rosca-scott-com-halteres.webp'),
(1, 'Rosca Scott no Cabo', 'Bíceps', '/exercises/rosca-scott-no-cabo.webp'),
(1, 'Rosca Scott Inversa', 'Bíceps', '/exercises/rosca-scott-inversa.webp'),
(1, 'Rosca Pegada Fechada', 'Bíceps', '/exercises/rosca-pegada-fechada.webp'),
(1, 'Rosca Pegada Larga', 'Bíceps', '/exercises/rosca-pegada-larga.webp'),
(1, 'Rosca EZ Pegada Fechada', 'Bíceps', '/exercises/rosca-ez-pegada-fechada.webp'),
(1, 'Drag Curl', 'Bíceps', '/exercises/drag-curl.webp'),
(1, 'Rosca Zottman', 'Bíceps', '/exercises/rosca-zottman.webp'),
(1, 'Rosca no Cabo Alto', 'Bíceps', '/exercises/rosca-no-cabo-alto.webp'),
(1, 'Rosca Unilateral no Cabo', 'Bíceps', '/exercises/rosca-unilateral-no-cabo.webp'),
(1, 'Rosca Inversa no Cabo', 'Bíceps', '/exercises/rosca-inversa-no-cabo.webp'),
(1, 'Rosca na Máquina', 'Bíceps', '/exercises/rosca-na-maquina.webp'),
(1, 'Rosca Concentrada em Pé', 'Bíceps', '/exercises/rosca-concentrada-em-pe.webp'),
(1, 'Rosca Inversa com Halteres', 'Bíceps', '/exercises/rosca-inversa-com-halteres.webp'),
(1, 'Tríceps na Polia com Barra V', 'Tríceps', '/exercises/triceps-na-polia-com-barra-v.webp'),
(1, 'Tríceps Unilateral no Cabo', 'Tríceps', '/exercises/triceps-unilateral-no-cabo.webp'),
(1, 'Tríceps Corda Acima da Cabeça', 'Tríceps', '/exercises/triceps-corda-acima-da-cabeca.webp'),
(1, 'Tríceps Deitado no Cabo', 'Tríceps', '/exercises/triceps-deitado-no-cabo.webp'),
(1, 'Tríceps Testa com Halteres', 'Tríceps', '/exercises/triceps-testa-com-halteres.webp'),
(1, 'Tríceps Testa Declinado', 'Tríceps', '/exercises/triceps-testa-declinado.webp'),
(1, 'Tríceps Testa Inclinado', 'Tríceps', '/exercises/triceps-testa-inclinado.webp'),
(1, 'Tríceps Francês com Barra', 'Tríceps', '/exercises/triceps-frances-com-barra.webp'),
(1, 'Tríceps Francês Unilateral', 'Tríceps', '/exercises/triceps-frances-unilateral.webp'),
(1, 'Tríceps Francês Sentado', 'Tríceps', '/exercises/triceps-frances-sentado.webp'),
(1, 'Tate Press', 'Tríceps', '/exercises/tate-press.webp'),
(1, 'JM Press', 'Tríceps', '/exercises/jm-press.webp'),
(1, 'Supino Fechado com Halteres', 'Tríceps', '/exercises/supino-fechado-com-halteres.webp'),
(1, 'Supino Fechado no Smith', 'Tríceps', '/exercises/supino-fechado-no-smith.webp'),
(1, 'Mergulho na Máquina', 'Tríceps', '/exercises/mergulho-na-maquina.webp'),
(1, 'Mergulho no Banco com Peso', 'Tríceps', '/exercises/mergulho-no-banco-com-peso.webp'),
(1, 'Tríceps na Máquina', 'Tríceps', '/exercises/triceps-na-maquina.webp'),
(1, 'Flexões Fechadas Inclinadas', 'Tríceps', '/exercises/flexoes-fechadas-inclinadas.webp'),
(1, 'Hip Thrust no Smith', 'Glúteos', '/exercises/hip-thrust-no-smith.webp'),
(1, 'Pull Through no Cabo', 'Glúteos', '/exercises/pull-through-no-cabo.webp'),
(1, 'Extensão de Anca com Elástico', 'Glúteos', '/exercises/extensao-de-anca-com-elastico.webp'),
(1, 'Ponte de Glúteos com Elástico', 'Glúteos', '/exercises/ponte-de-gluteos-com-elastico.webp'),
(1, 'Ponte de Glúteos na Bola', 'Glúteos', '/exercises/ponte-de-gluteos-na-bola.webp'),
(1, 'Levantamento Terra Unilateral', 'Glúteos', '/exercises/levantamento-terra-unilateral.webp'),
(1, 'Stiff com Halteres', 'Glúteos', '/exercises/stiff-com-halteres.webp'),
(1, 'Stiff no Smith', 'Glúteos', '/exercises/stiff-no-smith.webp'),
(1, 'Kettlebell Swing', 'Glúteos', '/exercises/kettlebell-swing.webp'),
(1, 'Subida ao Banco com Barra', 'Glúteos', '/exercises/subida-ao-banco-com-barra.webp'),
(1, 'Afundo Caminhando com Barra', 'Glúteos', '/exercises/afundo-caminhando-com-barra.webp'),
(1, 'Afundo Elevado', 'Glúteos', '/exercises/afundo-elevado.webp'),
(1, 'Glute Ham Raise', 'Glúteos', '/exercises/glute-ham-raise.webp'),
(1, 'Adução de Anca no Cabo', 'Pernas', '/exercises/aducao-de-anca-no-cabo.webp'),
(1, 'Levantamento Terra com Trap Bar', 'Costas', '/exercises/levantamento-terra-com-trap-bar.webp'),
(1, 'Levantamento Terra no Cabo', 'Costas', '/exercises/levantamento-terra-no-cabo.webp'),
(1, 'Flutter Kicks', 'Abdominais', '/exercises/flutter-kicks.webp'),
(1, 'Elevação de Joelhos nas Paralelas', 'Abdominais', '/exercises/elevacao-de-joelhos-nas-paralelas.webp')
  ) AS v(gym_id, name, muscle_group, image_url)
 WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.gym_id = v.gym_id AND e.name = v.name);
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
-- Permite remover pessoas da equipa (gestão do CEO) sem perder dados: o que
-- apontava para a pessoa removida fica sem ligação (SET NULL) em vez de
-- impedir a remoção. Um plano com created_by NULL passa a significar
-- "criado por alguém que já saiu do ginásio" (os colegas da mesma
-- especialidade podem continuar a editá-lo). Já incluído no schema.sql.
--   psql -U <user> -d workout_tracker -f backend/db/migrations/009_remove_people.sql
ALTER TABLE member_subscriptions
    DROP CONSTRAINT IF EXISTS member_subscriptions_assigned_staff_id_fkey,
    ADD CONSTRAINT member_subscriptions_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE body_metrics
    DROP CONSTRAINT IF EXISTS body_metrics_recorded_by_fkey,
    ADD CONSTRAINT body_metrics_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE workout_plans ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE workout_plans
    DROP CONSTRAINT IF EXISTS workout_plans_created_by_fkey,
    ADD CONSTRAINT workout_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE nutrition_plans
    DROP CONSTRAINT IF EXISTS nutrition_plans_created_by_fkey,
    ADD CONSTRAINT nutrition_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
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
-- 012: role "dono" (dono da plataforma), gym_id nullable,
--      códigos de convite e tabela de clientes externos.

-- 1. Novo role na enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dono';

-- 2. gym_id passa a ser nullable (DONO e clientes externos não pertencem a um ginásio)
ALTER TABLE users ALTER COLUMN gym_id DROP NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_gym_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_gym_id_fkey
  FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE SET NULL;

-- 3. Código de convite único para PTs e nutricionistas
ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20) UNIQUE;

-- 4. Clientes externos: pessoas que usam a app mas não são sócias do ginásio,
--    ligadas a um coach (PT / nutricionista) via código de convite.
CREATE TABLE IF NOT EXISTS external_coach_clients (
    id          SERIAL PRIMARY KEY,
    coach_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gym_id      INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, client_id)
);
CREATE INDEX IF NOT EXISTS idx_ext_clients_coach ON external_coach_clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_ext_clients_client ON external_coach_clients(client_id);
-- Taxas de remuneração por staff (uma entrada por pessoa×ginásio)
CREATE TABLE IF NOT EXISTS staff_rates (
  staff_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id     INT NOT NULL REFERENCES gyms(id)  ON DELETE CASCADE,
  rate_per_session  DECIMAL(10,2) NOT NULL DEFAULT 0,
  rate_per_class    DECIMAL(10,2) NOT NULL DEFAULT 0,
  base_salary       DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (staff_id, gym_id)
);

-- Registos semanais de sessões/aulas realizadas (snapshot confirmável pelo CEO)
CREATE TABLE IF NOT EXISTS payroll_weeks (
  id            SERIAL PRIMARY KEY,
  staff_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id        INT NOT NULL REFERENCES gyms(id)  ON DELETE CASCADE,
  week_start    DATE NOT NULL,
  sessions_count INT NOT NULL DEFAULT 0,
  classes_count  INT NOT NULL DEFAULT 0,
  notes          TEXT,
  confirmed      BOOLEAN NOT NULL DEFAULT false,
  confirmed_by   INT REFERENCES users(id),
  confirmed_at   TIMESTAMPTZ,
  UNIQUE(staff_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_payroll_gym_week ON payroll_weeks(gym_id, week_start);

-- Check-ins do ginásio (ocupação em tempo real)
CREATE TABLE IF NOT EXISTS gym_checkins (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gym_id         INT NOT NULL REFERENCES gyms(id)  ON DELETE CASCADE,
  checked_in_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_out_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_checkins_active ON gym_checkins(gym_id, user_id) WHERE checked_out_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_checkins_gym_date ON gym_checkins(gym_id, checked_in_at);
-- Reformulação das tabelas de financeiro para o modelo correto:
-- Salário base, taxas horárias por tipo de trabalho, taxa mensal PT por cliente,
-- e retenção do ginásio (% ou € fixo).

ALTER TABLE staff_rates
  DROP COLUMN IF EXISTS rate_per_session,
  DROP COLUMN IF EXISTS rate_per_class,
  ADD COLUMN IF NOT EXISTS rate_reception_h DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_sala_h      DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_class_h     DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_pt_month    DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gym_cut_pct      DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS gym_cut_fixed    DECIMAL(10,2);

ALTER TABLE payroll_weeks
  DROP COLUMN IF EXISTS sessions_count,
  DROP COLUMN IF EXISTS classes_count,
  ADD COLUMN IF NOT EXISTS hours_reception   DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hours_sala        DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hours_class       DECIMAL(8,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pt_clients_count  INT          NOT NULL DEFAULT 0;
-- Per-occurrence class confirmations (instructor + reception two-part sign-off)
CREATE TABLE IF NOT EXISTS class_occurrences (
  id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES group_classes(id) ON DELETE CASCADE,
  gym_id   INT NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  class_date DATE NOT NULL,
  instructor_confirmed     BOOLEAN NOT NULL DEFAULT FALSE,
  instructor_confirmed_at  TIMESTAMPTZ,
  reception_confirmed      BOOLEAN NOT NULL DEFAULT FALSE,
  reception_confirmed_at   TIMESTAMPTZ,
  UNIQUE(class_id, class_date)
);

-- Minutes before class start within which a pending substitute request triggers auto-cancel
ALTER TABLE group_classes ADD COLUMN IF NOT EXISTS sub_cutoff_minutes INT NOT NULL DEFAULT 30;
-- Performance indexes for hot query paths

-- users: gym_id é o filtro mais comum em todos os queries de staff/membros
CREATE INDEX IF NOT EXISTS idx_users_gym_id        ON users(gym_id);
CREATE INDEX IF NOT EXISTS idx_users_gym_role      ON users(gym_id, role);

-- staff_shifts: listDaily e TeamSchedule filtram por gym + weekday
CREATE INDEX IF NOT EXISTS idx_shifts_gym_weekday  ON staff_shifts(gym_id, weekday);

-- staff_attendance: leituras por ginásio+data e por staff+data
CREATE INDEX IF NOT EXISTS idx_attendance_gym_date   ON staff_attendance(gym_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON staff_attendance(staff_id, shift_date);

-- group_classes: listClasses e listDaily filtram por gym + weekday
CREATE INDEX IF NOT EXISTS idx_classes_gym_weekday ON group_classes(gym_id, weekday);

-- class_enrollments: contagens por (class_id, class_date) e lookup por member
CREATE INDEX IF NOT EXISTS idx_enrollments_class_date ON class_enrollments(class_id, class_date);
CREATE INDEX IF NOT EXISTS idx_enrollments_member     ON class_enrollments(member_id);

-- class_cancellations e class_occurrences: lookup por (class_id, class_date)
CREATE INDEX IF NOT EXISTS idx_cancellations_class_date  ON class_cancellations(class_id, class_date);
CREATE INDEX IF NOT EXISTS idx_occurrences_class_date    ON class_occurrences(class_id, class_date);

-- messages: caixa de entrada ordenada por data
CREATE INDEX IF NOT EXISTS idx_messages_recipient_date ON messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender         ON messages(sender_id);

-- member_subscriptions: lookup por staff e por membro
CREATE INDEX IF NOT EXISTS idx_subscriptions_staff  ON member_subscriptions(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON member_subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON member_subscriptions(member_id, is_active) WHERE is_active = true;

-- workout_sessions e body_metrics: última atividade por utilizador
CREATE INDEX IF NOT EXISTS idx_sessions_user_date  ON workout_sessions(user_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_member_date ON body_metrics(member_id, recorded_at DESC);

-- staff_rates: lookup por staff+gym
CREATE INDEX IF NOT EXISTS idx_rates_staff_gym ON staff_rates(staff_id, gym_id);
-- 017: monthly_fee por cliente externo (o PT define quanto cobra a cada um)
ALTER TABLE external_coach_clients ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
-- 018: cor de destaque personalizável por ginásio
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS accent_color VARCHAR(7);

-- 023: sistema de amigos (seguir, sem aprovação, entre ginásios) — código
-- próprio por utilizador, distinto do invite_code (que é para onboarding
-- de clientes de um PT/nutricionista).
ALTER TABLE users ADD COLUMN IF NOT EXISTS friend_code VARCHAR(10) UNIQUE;

CREATE TABLE IF NOT EXISTS friendships (
    id           SERIAL PRIMARY KEY,
    follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followee_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (follower_id, followee_id),
    CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_follower ON friendships(follower_id);
CREATE INDEX IF NOT EXISTS idx_friendships_followee ON friendships(followee_id);

-- 024: exercícios personalizados (owner_id NULL = catálogo do ginásio,
-- owner_id definido = pessoal, só visível para quem o criou).
ALTER TABLE exercises ALTER COLUMN gym_id DROP NOT NULL;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_exercises_owner ON exercises(owner_id);

-- 025: preço de cada serviço (ginásio, PT, nutrição), por agora um valor
-- fixo por ginásio — NÃO varia por membro/plano ainda (limitação
-- conhecida, ver PROGRESS.txt).
CREATE TABLE IF NOT EXISTS gym_service_prices (
    id              SERIAL PRIMARY KEY,
    gym_id          INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
    service_type    service_type NOT NULL,
    price_cents     INTEGER NOT NULL,
    billing_period  VARCHAR(20) NOT NULL DEFAULT 'monthly',
    UNIQUE (gym_id, service_type)
);
INSERT INTO gym_service_prices (gym_id, service_type, price_cents, billing_period)
SELECT g.id, s.service_type, s.price_cents, 'monthly'
  FROM gyms g
 CROSS JOIN (VALUES
    ('gym_membership'::service_type, 3000),
    ('personal_training'::service_type, 4500),
    ('nutrition_plan'::service_type, 2500)
 ) AS s(service_type, price_cents)
ON CONFLICT (gym_id, service_type) DO NOTHING;

-- 026: estado de pagamento de cada subscrição (paid_until — "pago até"),
-- para distinguir "em dia" de "em atraso" no perfil, além de só
-- ativo/inativo. Aplica-se às três subscrições por igual. "Em atraso" é só
-- um aviso visual — não mexe em contagens/estatísticas nem em acessos
-- (ver PROGRESS.txt).
ALTER TABLE member_subscriptions ADD COLUMN IF NOT EXISTS paid_until DATE DEFAULT CURRENT_DATE;
UPDATE gym_service_prices SET price_cents = 3000 WHERE service_type = 'gym_membership';

-- 027: registo em duas fases (email → nome/password) com confirmação por
-- email, e login/registo com Google. password_hash fica nullable para
-- contas só-Google. email_verified marca quem já confirmou — contas já
-- existentes ficam logo confirmadas.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;

-- 028: técnica planeada por exercício de plano (ver set_logs.set_type) —
-- passa a poder escolher-se ao montar o plano, não só ao registar o treino.
ALTER TABLE plan_exercises
    ADD COLUMN IF NOT EXISTS set_type VARCHAR(20) NOT NULL DEFAULT 'normal'
        CHECK (set_type IN ('normal', 'drop', 'rest_pause', 'cluster', 'superset', 'pyramid', 'failure'));

-- 029: cada série de um exercício de plano passa a poder ter o seu próprio
-- alvo (reps/carga), em vez de um só valor aplicado a todas (ex: pirâmide).
-- Mesma ideia de set_logs, mas para o que está planeado, não o que foi
-- feito. Migra target_sets séries iguais para uma linha por série antes de
-- remover as colunas antigas.
CREATE TABLE IF NOT EXISTS plan_exercise_sets (
    id                SERIAL PRIMARY KEY,
    plan_exercise_id  INTEGER NOT NULL REFERENCES plan_exercises(id) ON DELETE CASCADE,
    set_number        INTEGER NOT NULL,
    target_reps       INTEGER,
    target_reps_max   INTEGER,
    target_load       NUMERIC(6,2)
);
CREATE INDEX IF NOT EXISTS idx_plan_exercise_sets_pe ON plan_exercise_sets(plan_exercise_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'plan_exercises' AND column_name = 'target_sets'
  ) THEN
    INSERT INTO plan_exercise_sets (plan_exercise_id, set_number, target_reps, target_reps_max, target_load)
    SELECT pe.id, s, pe.target_reps, pe.target_reps_max, pe.target_load
      FROM plan_exercises pe
     CROSS JOIN LATERAL generate_series(1, GREATEST(pe.target_sets, 1)) AS s
     WHERE NOT EXISTS (SELECT 1 FROM plan_exercise_sets WHERE plan_exercise_id = pe.id);

    ALTER TABLE plan_exercises
        DROP COLUMN target_sets,
        DROP COLUMN target_reps,
        DROP COLUMN target_reps_max,
        DROP COLUMN target_load;
  END IF;
END $$;
