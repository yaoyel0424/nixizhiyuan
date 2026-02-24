import { SetMetadata } from '@nestjs/common';

/**
 * 校验类型（两套逻辑互不混合）：
 * - popular_major：热门专业权益校验（解锁全部/已购/免费额度）
 * - require_sign：所有专业下「未收费时凭 sign 访问」；仅校验 query.sign 有效即可放行
 */
export type EntitlementCheckType = 'popular_major' | 'require_sign';

/**
 * 权益/访问校验元数据（供 EntitlementGuard 读取）
 */
export interface RequireEntitlementMetadata {
  /** 校验类型 */
  type: EntitlementCheckType;
  /**
   * 仅 type 为 popular_major 时使用。路由参数名：
   * - 'popularMajorId'：参数值为热门专业 id（数字），Guard 会查表转成 majorCode
   * - 'majorCode'：参数值已是专业代码（如 010101），Guard 直接用于权益校验
   */
  paramKey?: string;
}

export const REQUIRE_ENTITLEMENT_KEY = 'requireEntitlement';

/**
 * 标记该路由需要做访问校验（与 type 对应，只执行一种逻辑）
 * - popular_major：仅做热门专业权益校验，无权益 402
 * - require_sign：仅做 sign 校验，未收费时凭 query.sign 访问；无有效 sign 则 402。其他所有专业接口不加此装饰即不限制
 * @example
 * @RequireEntitlement({ type: 'popular_major', paramKey: 'popularMajorId' })  // 路由带 :popularMajorId
 * @RequireEntitlement({ type: 'popular_major', paramKey: 'majorCode' })       // 路由带 :majorCode
 * @RequireEntitlement({ type: 'require_sign' })
 */
export const RequireEntitlement = (metadata: RequireEntitlementMetadata) =>
  SetMetadata(REQUIRE_ENTITLEMENT_KEY, metadata);
