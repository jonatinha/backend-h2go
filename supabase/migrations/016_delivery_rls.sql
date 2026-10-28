-- 016_delivery_rls.sql

ALTER TABLE public.delivery_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_driver_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_delivery_driver()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'delivery'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Admins manage delivery drivers" ON public.delivery_drivers;
CREATE POLICY "Admins manage delivery drivers"
    ON public.delivery_drivers FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Drivers read own row" ON public.delivery_drivers;
CREATE POLICY "Drivers read own row"
    ON public.delivery_drivers FOR SELECT
    USING (profile_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage delivery regions" ON public.delivery_regions;
CREATE POLICY "Admins manage delivery regions"
    ON public.delivery_regions FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Active drivers read active regions" ON public.delivery_regions;
CREATE POLICY "Active drivers read active regions"
    ON public.delivery_regions FOR SELECT
    USING (is_active = TRUE AND (public.is_delivery_driver() OR public.is_admin()));

DROP POLICY IF EXISTS "Admins manage driver regions" ON public.delivery_driver_regions;
CREATE POLICY "Admins manage driver regions"
    ON public.delivery_driver_regions FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Drivers read own region links" ON public.delivery_driver_regions;
CREATE POLICY "Drivers read own region links"
    ON public.delivery_driver_regions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.delivery_drivers d
            WHERE d.id = delivery_driver_regions.driver_id
              AND (d.profile_id = auth.uid() OR public.is_admin())
        )
    );

DROP POLICY IF EXISTS "Admins manage assignments" ON public.delivery_assignments;
CREATE POLICY "Admins manage assignments"
    ON public.delivery_assignments FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Drivers read own assignments" ON public.delivery_assignments;
CREATE POLICY "Drivers read own assignments"
    ON public.delivery_assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.delivery_drivers d
            WHERE d.id = delivery_assignments.driver_id
              AND d.profile_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Admins read delivery events" ON public.delivery_events;
CREATE POLICY "Admins read delivery events"
    ON public.delivery_events FOR SELECT
    USING (public.is_admin());
