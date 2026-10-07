-- 010_settings.sql
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(key);

-- Insert default system settings
INSERT INTO public.system_settings (key, value, description, is_public) VALUES
('STORE_NAME', 'H2GO Smart', 'Nome da Loja', true),
('STORE_CITY', 'Ribeirão Branco', 'Cidade de Atendimento', true),
('STORE_STATE', 'SP', 'Estado de Atendimento', true),
('SHIPPING_FEE', '4.98', 'Taxa de Frete Padrão em Ribeirão Branco', true),
('CURRENCY', 'BRL', 'Moeda Padrão', true),
('STORE_ACTIVE', 'true', 'Status de Funcionamento da Loja', true),
('PAYMENT_ENABLED', 'false', 'Se pagamentos online automáticos estão ativos', true),
('ALLOW_CASH_PAYMENT', 'true', 'Permitir pagamento na entrega', true)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
