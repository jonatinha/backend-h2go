import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export const isSupabaseConfigured = (): boolean => {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }
  const url = env.SUPABASE_URL || '';
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  return (
    Boolean(url) &&
    !url.includes('your-project') &&
    !url.includes('mock-supabase') &&
    Boolean(key) &&
    !key.includes('your-supabase') &&
    !key.includes('mock-service-role-key')
  );
};

export const supabaseAdmin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const supabaseAnon: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
