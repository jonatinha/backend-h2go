import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

const isTest = process.env.NODE_ENV === 'test';

// Valores locais apenas para permitir a importação dos módulos em desenvolvimento/testes.
// Não são credenciais válidas e nunca devem ser usados em produção.
const fallbackUrl = 'http://127.0.0.1:54321';
const fallbackKey = 'local-development-placeholder-key';

const supabaseUrl = env.SUPABASE_URL ?? fallbackUrl;
const supabaseAnonKey = env.SUPABASE_ANON_KEY ?? fallbackKey;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? fallbackKey;

export const isSupabaseConfigured = (): boolean => {
  if (isTest) return false;

  const url = env.SUPABASE_URL ?? '';
  const anonKey = env.SUPABASE_ANON_KEY ?? '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  return (
    /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co$/.test(url) &&
    Boolean(anonKey) &&
    Boolean(serviceKey) &&
    !/mock|placeholder|your-project|your-supabase|example/i.test(
      `${url} ${anonKey} ${serviceKey}`
    )
  );
};

if (env.NODE_ENV === 'production' && !isSupabaseConfigured()) {
  throw new Error(
    'Configuração do Supabase inválida ou incompleta para produção.'
  );
}

const clientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  clientOptions
);

export const supabaseAnon: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  clientOptions
);
