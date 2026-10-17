-- 020: segunda cor do tema do ginásio (cor principal + cor secundária,
-- em vez de só uma cor com tons derivados matematicamente — mais
-- simples e previsível para o CEO escolher).
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7);
