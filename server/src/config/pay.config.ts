import { registerAs } from '@nestjs/config';

/**
 * 微信支付与分账配置
 * 需在 .env 中配置：WECHAT_APPID, WX_PAY_MCHID, WX_PAY_NOTIFY_URL, WX_PAY_V3_KEY
 * 证书放在 server/pay-key：apiclient_cert.pem, apiclient_key.pem
 * 公钥模式（无平台证书时）：WX_PAY_PUB_KEY_ID（商户平台下载的公钥 ID，如 PUB_KEY_ID_xxx）、pub_key.pem 放 certDir
 */
export default registerAs('pay', () => ({
  appid: process.env.WECHAT_APPID || process.env.WECHAT_APP_ID || '',
  mchid: process.env.WX_PAY_MCHID || '',
  notifyUrl: process.env.WX_PAY_NOTIFY_URL || '',
  v3Key: process.env.WX_PAY_V3_KEY || '',
  /** 证书目录（相对项目根或绝对路径），默认 pay-key */
  certDir: process.env.WX_PAY_CERT_DIR || 'pay-key',
  /** 微信支付公钥 ID（公钥模式必填），格式 PUB_KEY_ID_xxx，分账等接口请求头 Wechatpay-Serial 使用 */
  wxPubKeyId: process.env.WX_PAY_PUB_KEY_ID || '',
}));
