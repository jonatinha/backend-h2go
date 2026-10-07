import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),
  
  SUPABASE_URL: z.string().url().default('https://mock-supabase.supabase.co'),
  SUPABASE_ANON_KEY: z.string().default('mock-anon-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('mock-service-role-key'),
  DATABASE_URL: z.string().optional(),
  
  JWT_SECRET: z.string().default('default-super-secret-jwt-key-min-32-chars-h2go'),
  
  OPS_ADMIN_USERNAME: z.string().default('admin'),
  OPS_ADMIN_PASSWORD: z.string().default('admin-h2go-smart-change-me'),
  
  STORE_NAME: z.string().default('H2GO Smart'),
  STORE_CITY: z.string().default('Ribeirão Branco'),
  STORE_STATE: z.string().default('SP'),
  SHIPPING_FEE_RIBEIRAO_BRANCO: z.coerce.number().default(4.98),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Erro de validação das variáveis de ambiente:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
