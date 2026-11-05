UPDATE public.system_settings
SET is_public = FALSE, updated_at = NOW()
WHERE key IN ('COMPANY_CNPJ', 'COMPANY_LEGAL_NAME');
