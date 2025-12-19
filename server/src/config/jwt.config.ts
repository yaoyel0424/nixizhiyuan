import { registerAs } from '@nestjs/config';

/**
 * JWT 配置
 */
export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET || '4e7ee6b641b3354834c475942f66b4f687242190b0b17fe999cde562027daf36',
  expiresIn: process.env.JWT_EXPIRES_IN || '15d',
  refreshSecret: process.env.JWT_REFRESH_SECRET || '305d8a7d3c9a492e18f3ee945637302dc86af6e12badfd436fcc12917688cfa0',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
}));

