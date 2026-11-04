CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment')),
    quantity INT NOT NULL CHECK (quantity > 0),
    balance_after INT NOT NULL CHECK (balance_after >= 0),
    note TEXT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_order ON public.stock_movements (order_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage stock movements" ON public.stock_movements;
CREATE POLICY "Admins can manage stock movements"
    ON public.stock_movements FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

UPDATE public.products
SET stock_control_enabled = TRUE
WHERE stock_control_enabled = FALSE;
