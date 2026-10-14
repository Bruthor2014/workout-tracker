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
