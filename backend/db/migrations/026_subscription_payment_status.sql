-- 026: estado de pagamento de cada subscrição (paid_until — "pago até"),
-- para distinguir "em dia" de "em atraso" no perfil, além de só
-- ativo/inativo. Aplica-se às três subscrições (ginásio, PT, nutrição) por
-- igual, a pedido explícito do utilizador. "Em atraso" é só um aviso
-- visual — não mexe em contagens/estatísticas de membros ativos nem em
-- acessos (ver PROGRESS.txt).
ALTER TABLE member_subscriptions ADD COLUMN IF NOT EXISTS paid_until DATE DEFAULT CURRENT_DATE;

-- Preço da inscrição no ginásio ajustado para 30€ (pedido do utilizador).
UPDATE gym_service_prices SET price_cents = 3000 WHERE service_type = 'gym_membership';
