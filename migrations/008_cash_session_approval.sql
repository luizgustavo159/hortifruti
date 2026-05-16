-- Adicionar coluna para rastrear quem aprovou a abertura do caixa
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS approval_token TEXT;

-- Adicionar nova ação de aprovação permitida
-- Nota: A lógica de validação de ações está no código, mas aqui garantimos a estrutura.
