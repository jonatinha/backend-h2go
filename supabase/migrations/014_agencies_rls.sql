-- 014_agencies_rls.sql

ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active pickup agencies" ON public.agencies;
CREATE POLICY "Public can view active pickup agencies"
    ON public.agencies FOR SELECT
    USING (
        (is_active = TRUE AND accepts_pickup = TRUE)
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Admins can manage agencies" ON public.agencies;
CREATE POLICY "Admins can manage agencies"
    ON public.agencies FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());
