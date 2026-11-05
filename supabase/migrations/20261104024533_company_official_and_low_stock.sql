INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
  (
    'COMPANY_LEGAL_NAME',
    'EDNA DE FRANCA LOUREIRO OLIVEIRA',
    'Razão social da empresa',
    TRUE
  ),
  (
    'COMPANY_CNPJ',
    '53.334.002/0001-83',
    'CNPJ da empresa',
    TRUE
  ),
  (
    'COMPANY_PHONE',
    '+55 15 98110-6153',
    'Telefone de contato da empresa',
    TRUE
  ),
  (
    'LOW_STOCK_THRESHOLD',
    '10',
    'Quantidade a partir da qual o estoque é considerado baixo',
    TRUE
  )
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  updated_at = NOW();

UPDATE public.system_settings
SET
  value = '+55 15 98110-6153',
  description = 'Telefone ou WhatsApp para o botão Fale Conosco do app entregador',
  is_public = TRUE,
  updated_at = NOW()
WHERE key = 'DRIVER_SUPPORT_PHONE';

UPDATE public.system_settings
SET
  value = 'https://wa.me/5515981106153',
  description = 'URL de atendimento (WhatsApp web, formulário, etc.)',
  is_public = TRUE,
  updated_at = NOW()
WHERE key = 'DRIVER_SUPPORT_URL'
  AND (value IS NULL OR btrim(value) = '');
