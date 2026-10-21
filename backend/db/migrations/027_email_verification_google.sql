-- 027: registo em duas fases (email → nome/password) com confirmação por
-- email, e login/registo com Google. password_hash fica nullable para
-- contas só-Google (sem password própria). email_verified marca quem já
-- confirmou — contas já existentes (e as criadas por staff via
-- createPerson) ficam logo confirmadas; só quem se regista agora pelo
-- formulário normal (sem Google) nasce por confirmar.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires_at TIMESTAMPTZ;
