-- 009_logs.sql
CREATE TABLE IF NOT EXISTS public.api_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    method VARCHAR(10) NOT NULL,
    route VARCHAR(255) NOT NULL,
    status_code INT NOT NULL,
    duration NUMERIC(10, 2) NOT NULL,
    ip VARCHAR(100),
    user_agent TEXT,
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_request_id ON public.api_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_status_code ON public.api_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON public.api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_method ON public.api_logs(method);
