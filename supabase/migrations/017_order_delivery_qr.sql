-- Token opaco do QR de baixa. O QR não usa o id do pedido.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_qr_token TEXT;

UPDATE public.orders
SET delivery_qr_token = encode(gen_random_bytes(24), 'hex')
WHERE delivery_qr_token IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN delivery_qr_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_delivery_qr_token
  ON public.orders (delivery_qr_token);
