import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  JWT_SECRET: z.string().optional(),

  // Login administrativo usa Supabase Auth; não usa senha local padrão.
  OPS_ADMIN_USERNAME: z.string().optional(),
  OPS_ADMIN_PASSWORD: z.string().optional(),

  STORE_NAME: z.string().default('H2GO Smart'),
  STORE_CITY: z.string().default('Ribeirão Branco'),
  STORE_STATE: z.string().default('SP'),
  SHIPPING_FEE_RIBEIRAO_BRANCO: z.coerce.number().nonnegative().default(4.98),

  /** Token secreto Mapbox (sk.*) — apenas backend / geocoding */
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Erro de validação das variáveis de ambiente:', parsed.error.format());
  process.exit(1);
}

const config = parsed.data;

if (config.NODE_ENV === 'production') {
  const missing: string[] = [];

  if (!config.SUPABASE_URL) missing.push('SUPABASE_URL');
  if (!config.SUPABASE_ANON_KEY) missing.push('SUPABASE_ANON_KEY');
  if (!config.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (!config.JWT_SECRET || config.JWT_SECRET.length < 32) {
    missing.push('JWT_SECRET (mínimo de 32 caracteres)');
  }

  if (
    config.JWT_SECRET &&
    /default-super-secret|change-me|changeme|mock|example/i.test(config.JWT_SECRET)
  ) {
    missing.push('JWT_SECRET forte e exclusivo');
  }

  if (!config.CORS_ORIGIN.trim() || config.CORS_ORIGIN.trim() === '*') {
    missing.push('CORS_ORIGIN com origens explícitas');
  }

  if (config.SUPABASE_URL?.includes('mock-supabase')) {
    missing.push('SUPABASE_URL real');
  }

  if (
    config.SUPABASE_ANON_KEY?.includes('mock-') ||
    config.SUPABASE_SERVICE_ROLE_KEY?.includes('mock-')
  ) {
    missing.push('chaves reais do Supabase');
  }

  if (missing.length > 0) {
    console.error(
      'Inicialização bloqueada: configuração de produção ausente ou insegura:',
      [...new Set(missing)]
    );
    process.exit(1);
  }
}

if (
  config.NODE_ENV !== 'production' &&
  (!config.JWT_SECRET || config.JWT_SECRET.length < 32)
) {
  console.warn(
    'JWT_SECRET não definido ou curto. Configure um segredo local forte antes de testar cookies assinados.'
  );
}

if (config.NODE_ENV === 'production' && !config.JWT_SECRET) {
  console.error('JWT_SECRET é obrigatório em produção.');
  process.exit(1);
}

export const env = {
  ...config,
  JWT_SECRET: config.JWT_SECRET ?? 'development-only-secret-not-for-production-32',
};
