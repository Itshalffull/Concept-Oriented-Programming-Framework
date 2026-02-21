// Conduit Example App — Configuration
// Reads settings from environment variables with sensible defaults.

export interface AppConfig {
  port: number;
  jwtSecret: string;
  storageBackend: 'memory' | 'redis' | 'dynamodb' | 'firestore' | 'cloudflare-kv' | 'cloudflare-do' | 'vercel-kv';
  transportMode: 'in-process' | 'http' | 'websocket';
  redisUrl: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    jwtSecret: process.env.JWT_SECRET || 'conduit-dev-secret',
    storageBackend: (process.env.STORAGE_BACKEND as AppConfig['storageBackend']) || 'memory',
    transportMode: (process.env.TRANSPORT_MODE as AppConfig['transportMode']) || 'in-process',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    logLevel: (process.env.LOG_LEVEL as AppConfig['logLevel']) || 'info',
  };
}
