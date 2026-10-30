INSERT INTO public.system_settings (key, value, description, is_public)
VALUES (
  'AUTO_ACCEPT_ORDERS',
  'false',
  'Aceita novos pedidos automaticamente (pending → confirmed)',
  false
)
ON CONFLICT (key) DO NOTHING;
