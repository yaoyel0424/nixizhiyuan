/**
 * 支付产品常量
 * 免费 2 个热门专业，之后每个 29.9 元；一次性解锁全部 299 元（已付热门专业可抵扣）
 */
export const FREE_POPULAR_MAJOR_COUNT = 2;
/** 单个热门专业价格（分） */
export const PRICE_POPULAR_MAJOR_CENTS = 2990; // 29.9 元
/** 一次性解锁全部原价（分） */
export const PRICE_UNLOCK_ALL_CENTS = 29900; // 299 元

export const PRODUCT_TYPE_POPULAR_MAJOR = 'popular_major';
export const PRODUCT_TYPE_UNLOCK_ALL = 'unlock_all';

/** 有代理（agent_id 不为空）时的价格折扣，如 0.9 表示九折 */
export const AGENT_DISCOUNT_RATE = 0.9;
/** 有代理时，订单金额中分给代理的比例，如 0.29 表示 29% */
export const AGENT_SPLIT_RATIO = 0.295;
