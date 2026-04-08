import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  PORT: parseInt(process.env['PORT'] ?? '3005', 10),
  NODE_ENV: process.env['NODE_ENV'] ?? 'development',
  JWT_SECRET: requireEnv('JWT_SECRET'),
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  ALLOWED_ORIGINS: process.env['ALLOWED_ORIGINS'] ?? 'http://localhost:3000',
  PET_SERVICE_URL: process.env['PET_SERVICE_URL'] ?? 'http://localhost:3002',
  USER_SERVICE_URL: process.env['USER_SERVICE_URL'] ?? 'http://localhost:3003',
};
