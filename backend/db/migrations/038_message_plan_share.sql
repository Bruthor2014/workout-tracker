-- Uma partilha de plano (ver 037_plan_shares.sql) também cria uma mensagem
-- normal na conversa com esse amigo — é aí que a pessoa a vê e decide
-- aceitar/dispensar, não numa caixa de entrada separada.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS plan_share_id INTEGER REFERENCES plan_shares(id) ON DELETE SET NULL;
