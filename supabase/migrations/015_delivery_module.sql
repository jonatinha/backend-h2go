-- 015_delivery_module.sql — Módulo de entregadores H2GO

-- Perfil: papel entregador
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('customer', 'admin', 'delivery'));

-- Coordenadas em endereços e pedidos (OPS / entrega)
ALTER TABLE public.addresses
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS driver_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS driver_id UUID,
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivery_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivery_completed_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.delivery_drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50),
    vehicle_brand VARCHAR(100),
    vehicle_model VARCHAR(100),
    vehicle_color VARCHAR(50),
    vehicle_plate VARCHAR(20),
    avatar_url TEXT,
    max_distance_km NUMERIC(8, 2),
    max_units INT,
    allowed_category_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    rules_override JSONB NOT NULL DEFAULT '{}'::jsonb,
    deliveries_count INT NOT NULL DEFAULT 0 CHECK (deliveries_count >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_drivers_profile ON public.delivery_drivers(profile_id);
CREATE INDEX IF NOT EXISTS idx_delivery_drivers_active ON public.delivery_drivers(is_active);

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_driver_id_fkey;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_driver_id_fkey
    FOREIGN KEY (driver_id) REFERENCES public.delivery_drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_dispatch
    ON public.orders (fulfillment_type, status, driver_id)
    WHERE fulfillment_type = 'delivery';

CREATE TABLE IF NOT EXISTS public.delivery_regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    boundary_type VARCHAR(20) NOT NULL CHECK (boundary_type IN ('polygon', 'radius', 'manual')),
    geometry JSONB NOT NULL DEFAULT '{}'::jsonb,
    center_lat DOUBLE PRECISION,
    center_lng DOUBLE PRECISION,
    radius_km NUMERIC(8, 2),
    neighborhoods JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_regions_active ON public.delivery_regions(is_active);

CREATE TABLE IF NOT EXISTS public.delivery_driver_regions (
    driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE CASCADE,
    region_id UUID NOT NULL REFERENCES public.delivery_regions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (driver_id, region_id)
);

CREATE TYPE public.delivery_assignment_status AS ENUM (
    'accepted',
    'en_route_pickup',
    'picked_up',
    'en_route_delivery',
    'completed',
    'cancelled'
);

CREATE TABLE IF NOT EXISTS public.delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.delivery_drivers(id) ON DELETE RESTRICT,
    status public.delivery_assignment_status NOT NULL DEFAULT 'accepted',
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver
    ON public.delivery_assignments(driver_id, status);

CREATE TABLE IF NOT EXISTS public.delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    driver_id UUID REFERENCES public.delivery_drivers(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_order ON public.delivery_events(order_id, created_at DESC);

INSERT INTO public.system_settings (key, value, description, is_public)
VALUES
    (
        'DRIVER_SUPPORT_PHONE',
        '',
        'Telefone ou WhatsApp para o botão Fale Conosco do app entregador',
        TRUE
    ),
    (
        'DRIVER_SUPPORT_URL',
        '',
        'URL de atendimento (WhatsApp web, formulário, etc.)',
        TRUE
    ),
    (
        'DISPATCH_ORIGIN_LAT',
        '',
        'Latitude do ponto de origem para cálculo de distância de corridas',
        FALSE
    ),
    (
        'DISPATCH_ORIGIN_LNG',
        '',
        'Longitude do ponto de origem para cálculo de distância de corridas',
        FALSE
    ),
    (
        'DRIVER_DISPATCH_STATUSES',
        '["preparing"]',
        'Status de pedido elegíveis para oferta aos entregadores (JSON array)',
        FALSE
    )
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description,
    is_public = EXCLUDED.is_public;

-- Aceite atômico de corrida
CREATE OR REPLACE FUNCTION public.accept_delivery_order(
    p_order_id UUID,
    p_driver_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_assignment_id UUID;
BEGIN
    UPDATE public.orders
    SET
        driver_id = p_driver_id,
        accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id
      AND driver_id IS NULL
      AND fulfillment_type = 'delivery'
      AND status = 'preparing';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_AVAILABLE';
    END IF;

    INSERT INTO public.delivery_assignments (order_id, driver_id, status, accepted_at)
    VALUES (p_order_id, p_driver_id, 'accepted', NOW())
    RETURNING id INTO v_assignment_id;

    INSERT INTO public.delivery_events (order_id, driver_id, event_type, payload)
    VALUES (p_order_id, p_driver_id, 'order_accepted', jsonb_build_object('assignment_id', v_assignment_id));

    UPDATE public.delivery_drivers
    SET updated_at = NOW()
    WHERE id = p_driver_id;

    RETURN v_assignment_id;
END;
$$;
