CREATE TABLE IF NOT EXISTS public.print_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.delivery_receipts(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    queue_status VARCHAR(16) NOT NULL DEFAULT 'active',
    printed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT print_requests_queue_status_check CHECK (queue_status IN ('active', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_print_requests_active_receipt
    ON public.print_requests(receipt_id)
    WHERE queue_status = 'active' AND printed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_print_requests_active_list
    ON public.print_requests(queue_status, created_at DESC)
    WHERE printed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_print_requests_order ON public.print_requests(order_id);

ALTER TABLE public.print_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage print requests" ON public.print_requests;
CREATE POLICY "Admins manage print requests"
    ON public.print_requests FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
