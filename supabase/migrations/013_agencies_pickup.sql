-- 013_agencies_pickup.sql
-- Retirada na agência: cadastro de agências + vínculo em pedidos

CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50),
    email VARCHAR(255),
    cep VARCHAR(20) NOT NULL,
    street VARCHAR(255) NOT NULL,
    number VARCHAR(50) NOT NULL,
    complement VARCHAR(255),
    neighborhood VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(10) NOT NULL,
    reference TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    pickup_instructions TEXT,
    opening_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
    accepts_pickup BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_active_pickup
    ON public.agencies (is_active, accepts_pickup, sort_order);

CREATE INDEX IF NOT EXISTS idx_agencies_city
    ON public.agencies (city, state);

-- Tipo de atendimento do pedido
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS fulfillment_type VARCHAR(20) NOT NULL DEFAULT 'delivery';

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_fulfillment_type_check
    CHECK (fulfillment_type IN ('delivery', 'pickup'));

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE RESTRICT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_contact_name VARCHAR(255);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_contact_phone VARCHAR(50);

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_scheduled_at TIMESTAMPTZ;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS ready_for_pickup_at TIMESTAMPTZ;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_type ON public.orders (fulfillment_type);
CREATE INDEX IF NOT EXISTS idx_orders_agency_id ON public.orders (agency_id);

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_fulfillment_location_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_fulfillment_location_check
    CHECK (
        (fulfillment_type = 'delivery' AND agency_id IS NULL)
        OR (
            fulfillment_type = 'pickup'
            AND agency_id IS NOT NULL
            AND address_id IS NULL
        )
    );

-- Status extra para fluxo de retirada na agência
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (
        status::text = ANY (
            ARRAY[
                'pending',
                'confirmed',
                'preparing',
                'ready_for_pickup',
                'out_for_delivery',
                'delivered',
                'cancelled'
            ]::text[]
        )
    );

-- Feature flags (desligado até implementar no app)
INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
    (
        'PICKUP_ENABLED',
        'false',
        'Habilita a opção de retirada na agência no checkout',
        TRUE
    ),
    (
        'PICKUP_SHIPPING_FEE',
        '0.00',
        'Taxa de frete aplicada em pedidos com retirada na agência',
        TRUE
    )
ON CONFLICT (key) DO UPDATE
SET
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public,
    updated_at = NOW();
