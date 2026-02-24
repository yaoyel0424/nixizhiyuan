import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementService } from '@/pay/entitlement.service';
import {
  REQUIRE_ENTITLEMENT_KEY,
  RequireEntitlementMetadata,
} from '../decorators/require-entitlement.decorator';
import { IdTransformUtil } from '../utils/id-transform.util';

/**
 * 访问校验守卫
 * 根据 @RequireEntitlement() 的 type 只执行一种逻辑（互不混合）：
 * - popular_major：仅热门专业权益校验（无权益 402）
 * - require_sign：仅凭有效 query.sign 放行（所有专业下未收费时用；无有效 sign 402）
 * 需在已认证（request.user 已存在）的路由上使用。
 * 若 Users 表中该用户的 user_type 为 admin，则跳过所有权益/ sign 校验，直接放行。
 */
@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlementService: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.reflector.getAllAndOverride<RequireEntitlementMetadata | undefined>(
      REQUIRE_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { id: number };
      params?: Record<string, string>;
      query?: Record<string, string | undefined>;
      body?: { majorCode?: string };
    }>();
    const userId = request.user?.id;
    const params = request.params ?? {};
    const query = request.query ?? {};
    const body = request.body ?? {};

    if (userId == null) {
      throw new UnauthorizedException('请先登录后再访问');
    }

    const userType = await this.entitlementService.getUserTypeByUserId(userId);
    if (userType === 'adult') {
      return true;
    }

    // 两个顶级条件：满足一条即放行（popular_major / require_sign 等均适用）
    if (await this.entitlementService.hasUnlockAll(userId)) return true;

    const amountNum = await this.entitlementService.getUnlockAllPayAmount(userId);
    if (amountNum <= 0) return true;

    // 热门专业：仅做权益校验（不涉及 sign）
    if (metadata.type === 'popular_major') {
      const paramKey = metadata.paramKey ?? 'popularMajorId';
      const fromParams = params[paramKey];
      const fromQuery = query[paramKey];
      const raw =
        typeof fromParams === 'string'
          ? fromParams
          : typeof fromQuery === 'string'
            ? fromQuery
            : Array.isArray(fromQuery)
              ? (fromQuery[0] as string | undefined)
              : undefined;
      const paramValue = (raw ?? '').trim();
      if (paramValue === '') {
        return true;
      }
      let majorCode: string | null;
      if (paramKey === 'majorCode') {
        // 路由参数已是专业代码（如 majors 的 popular-majors/detail/:majorCode）
        majorCode = paramValue.trim();
      } else {
        // 路由参数是热门专业 id（如 scales 的 popular-major/:popularMajorId），需查表转成 majorCode
        const popularMajorId = Number(paramValue);
        if (Number.isNaN(popularMajorId)) {
          return true;
        }
        majorCode =
          await this.entitlementService.getMajorCodeByPopularMajorId(
            popularMajorId,
          );
      }
      if (!majorCode) {
        throw new NotFoundException('热门专业不存在');
      }

      if (await this.entitlementService.hasFreeUsedForMajor(userId, majorCode)) {
        return true;
      }

      const access =
        await this.entitlementService.checkEntitlementByUserId(
          userId,
          majorCode,
        );

      if (access.allowed) {
        if (access.reason === 'free_quota') {
          await this.entitlementService.recordFreeViewByUserId(userId, majorCode);
        }
        return true;
      }
      throw new HttpException(
        {
          code: 'PAY_REQUIRED',
          message: '免费额度已用完，请购买该热门专业或解锁全部',
          majorCode,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // 所有专业：仅做 sign 校验（未收费时凭 sign 访问；与热门专业权益无关）
    // majorCode 从两处接口获取：GET detail/:majorCode 用 params，POST favorites 用 body
    if (metadata.type === 'require_sign') {
      const signRaw = request.query?.sign;
      const majorCode =
        (typeof params.majorCode === 'string' && params.majorCode.trim()) ||
        (typeof body.majorCode === 'string' && body.majorCode.trim()) ||
        (typeof query.majorCode === 'string' && query.majorCode.trim()) ||
        '';
      const sign = typeof signRaw === 'string' ? signRaw.trim() : '';
      const decodedId = IdTransformUtil.decodeFrom32Hex(sign || undefined);
      console.log('decodedId', decodedId);
      console.log('majorCode', majorCode);
      if (decodedId !== null && majorCode !== '' && decodedId === majorCode) {
        return true;
      }
      throw new HttpException(
        {
          code: 'PAY_REQUIRED',
          message: '请付费后访问',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
