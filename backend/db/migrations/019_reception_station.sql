-- 019: novo role "reception_station" — a conta do PC fixo da receção
-- (ex: o computador partilhado do balcão, usado para registar entradas/
-- saídas e consultar/adicionar membros). É DIFERENTE de "receptionist",
-- que é uma pessoa normal da equipa (como um PT ou nutricionista), com
-- horário, presenças e salário geridos como qualquer outro staff.
-- "reception_station" não entra em horários, presenças nem financeiro —
-- não é uma pessoa, é um posto de trabalho partilhado.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'reception_station';
