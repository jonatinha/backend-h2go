ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_archived_at ON public.orders (archived_at);
