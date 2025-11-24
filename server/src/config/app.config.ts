import { registerAs } from '@nestjs/config';

/**
 * 应用配置
 */
export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'nestjs-backend-framework',
  port: parseInt(process.env.APP_PORT, 10) || 3000,
  prefix: process.env.APP_PREFIX || 'api/v1',
  env: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN?.split(',') || '*',
}));

