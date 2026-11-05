CREATE TABLE IF NOT EXISTS public.receipt_sequences (
    year INTEGER PRIMARY KEY,
    last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.delivery_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(32) NOT NULL UNIQUE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    status VARCHAR(32) NOT NULL DEFAULT 'pending_acceptance',
    amount NUMERIC(12, 2) NOT NULL,
    amount_extenso TEXT NOT NULL,
    payer_name TEXT NOT NULL,
    payer_document TEXT,
    payee_name TEXT NOT NULL,
    payee_document TEXT NOT NULL,
    reference_description TEXT NOT NULL,
    issue_city TEXT NOT NULL,
    issue_state VARCHAR(2) NOT NULL DEFAULT 'SP',
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    accepted_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    acceptance_ip TEXT,
    acceptance_user_agent TEXT,
    terms_version TEXT NOT NULL DEFAULT '1',
    scanned_by_role VARCHAR(16) NOT NULL,
    scanned_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    scanned_by_driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT delivery_receipts_status_check CHECK (
        status IN ('pending_acceptance', 'accepted', 'rejected', 'void')
    )
);

CREATE INDEX IF NOT EXISTS idx_delivery_receipts_order ON public.delivery_receipts(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_session ON public.delivery_receipts(session_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_status ON public.delivery_receipts(status);

ALTER TABLE public.delivery_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage delivery receipts" ON public.delivery_receipts;
CREATE POLICY "Admins manage delivery receipts"
    ON public.delivery_receipts FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Customers view own delivery receipts" ON public.delivery_receipts;
CREATE POLICY "Customers view own delivery receipts"
    ON public.delivery_receipts FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = delivery_receipts.order_id
              AND o.user_id = auth.uid()
        )
    );
