/**
 * 微信支付与回调相关类型定义
 */

/** 支付成功回调解密后的数据结构 */
export interface WxPayResult {
  mchid: string;
  appid: string;
  out_trade_no: string;
  transaction_id: string;
  trade_type: string;
  trade_state: string;
  trade_state_desc: string;
  bank_type: string;
  attach: string;
  success_time: string;
  payer: { openid: string };
  amount: {
    total: number;
    payer_total: number;
    currency: string;
    payer_currency: string;
  };
}

/** 微信支付回调请求体（加密） */
export interface WxPayNotifyBody {
  event_type: string;
  resource_type: string;
  resource: {
    ciphertext: string;
    associated_data: string;
    nonce: string;
  };
}

/** 支付队列 Job 负载 */
export interface PaymentJobPayload {
  transaction_id: string;
  out_trade_no: string;
  mchid: string;
  appid: string;
  trade_type: string;
  trade_state: string;
  trade_state_desc: string;
  bank_type: string;
  attach: string | null;
  success_time: string;
  openid: string;
  total: number;
  payer_total: number;
  currency: string;
  payer_currency: string;
}

/** 分账队列 Job 负载 */
export interface SplitJobPayload {
  transaction_id: string;
  order_id: number;
  out_trade_no: string;
  /** 分账接收方 openid（个人）或 type+account（商户等），按微信分账 API 要求 */
  receivers: Array<{ type: string; account?: string; openid?: string; amount: number; description: string }>;
}
