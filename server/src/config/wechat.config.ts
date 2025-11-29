import { registerAs } from '@nestjs/config';

/**
 * 微信配置
 */
export default registerAs('wechat', () => ({
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  callbackURL: process.env.WECHAT_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/wechat/callback',
}));

