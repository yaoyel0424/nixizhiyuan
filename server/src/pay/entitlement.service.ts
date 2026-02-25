import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/entities/user.entity';
import { UserEntitlement } from '@/entities/user-entitlement.entity';
import { UserFreePopularMajorRecord } from '@/entities/user-free-popular-major-record.entity';
import { PopularMajor } from '@/entities/popular-major.entity';
import {
  FREE_POPULAR_MAJOR_COUNT,
  PRICE_POPULAR_MAJOR_CENTS,
  PRICE_UNLOCK_ALL_CENTS,
  PRODUCT_TYPE_POPULAR_MAJOR,
  PRODUCT_TYPE_UNLOCK_ALL,
} from './pay.constants';

/** 权益校验结果：是否允许及原因（unlock_all 表示已解锁全部，所有操作均允许） */
export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: 'unlock_all' | 'paid' | 'free_quota';
}

/**
 * 用户权益服务
 * 负责：免费额度、已购热门专业、解锁全部、解锁全部抵扣金额
 */
@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(UserEntitlement)
    private readonly entitlementRepository: Repository<UserEntitlement>,
    @InjectRepository(UserFreePopularMajorRecord)
    private readonly freePopularMajorRecordRepository: Repository<UserFreePopularMajorRecord>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PopularMajor)
    private readonly popularMajorRepository: Repository<PopularMajor>,
  ) {}

  /**
   * 校验用户对某资源（majorCode）的访问权益，不消耗免费额度，仅判断
   */
  async checkEntitlement(
    userId: number | null,
    majorCode: string,
  ): Promise<EntitlementCheckResult> {
    if (userId == null) return { allowed: false };
    return this.checkEntitlementByUserId(userId, majorCode);
  }

  /**
   * 按 user_id 校验对某资源（majorCode）的访问权益（unlock_all 表示已解锁全部，所有操作均允许）
   */
  async checkEntitlementByUserId(
    userId: number,
    majorCode: string,
  ): Promise<EntitlementCheckResult> {
    if (await this.hasUnlockAllByUserId(userId)) return { allowed: true, reason: 'unlock_all' };
    const paidCodes = await this.getPaidMajorCodesByUserId(userId);
    if (paidCodes.includes(majorCode)) return { allowed: true, reason: 'paid' };
    const freeUsedCount = await this.freePopularMajorRecordRepository.count({
      where: { user_id: userId },
    });
    if (freeUsedCount < FREE_POPULAR_MAJOR_COUNT) return { allowed: true, reason: 'free_quota' };
    return { allowed: false };
  }

  /**
   * 按 user_id 消耗一次免费查看额度，并记录使用的专业（majorCode）
   * 同一用户对同一 majorCode 只记录一次，重复访问不重复扣额度
   */
  async recordFreeViewByUserId(userId: number, majorCode: string): Promise<void> {
    const already = await this.freePopularMajorRecordRepository.findOne({
      where: { user_id: userId, major_code: majorCode },
      select: ['id'],
    });
    if (already) return;
    const count = await this.freePopularMajorRecordRepository.count({
      where: { user_id: userId },
    });
    if (count >= FREE_POPULAR_MAJOR_COUNT) return;
    await this.freePopularMajorRecordRepository.save(
      this.freePopularMajorRecordRepository.create({
        user_id: userId,
        major_code: majorCode,
      }),
    );
  }

  /**
   * 是否已用完两个免费额度（用于验证 / 前端展示）
   */
  async hasUsedAllFreeQuota(userId: number | null): Promise<boolean> {
    if (userId == null) return false;
    const count = await this.freePopularMajorRecordRepository.count({
      where: { user_id: userId },
    });
    return count >= FREE_POPULAR_MAJOR_COUNT;
  }

  /**
   * 获取免费额度使用情况：已用次数、总额度、剩余次数、已使用的专业代码列表
   */
  async getFreeQuotaInfo(userId: number | null): Promise<{
    used: number;
    total: number;
    remaining: number;
    majorCodes: string[];
  }> {
    if (userId == null) {
      return {
        used: 0,
        total: FREE_POPULAR_MAJOR_COUNT,
        remaining: FREE_POPULAR_MAJOR_COUNT,
        majorCodes: [],
      };
    }
    const list = await this.freePopularMajorRecordRepository.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
      select: ['major_code'],
    });
    const used = list.length;
    const total = FREE_POPULAR_MAJOR_COUNT;
    const remaining = Math.max(0, total - used);
    const majorCodes = list.map((r) => r.major_code);
    return { used, total, remaining, majorCodes };
  }

  /**
   * 消耗一次免费查看额度并记录专业（在用户确实用免费额度查看时调用）
   */
  async recordFreeView(userId: number, majorCode: string): Promise<void> {
    await this.recordFreeViewByUserId(userId, majorCode);
  }

  /**
   * 判断用户是否已在 user_free_popular_major_records 中对该 majorCode 使用过免费额度（已用过则允许再次访问）
   */
  async hasFreeUsedForMajor(userId: number, majorCode: string): Promise<boolean> {
    const count = await this.freePopularMajorRecordRepository.count({
      where: { user_id: userId, major_code: majorCode },
    });
    return count > 0;
  }

  /**
   * 获取用户使用免费权益的热门专业代码列表（按使用时间顺序，最多 2 个）
   */
  async getFreeUsedMajorCodes(userId: number | null): Promise<string[]> {
    if (userId == null) return [];
    const list = await this.freePopularMajorRecordRepository.find({
      where: { user_id: userId },
      order: { created_at: 'ASC' },
      select: ['major_code'],
    });
    return list.map((r) => r.major_code);
  }

  /**
   * 热门专业权益汇总：免费使用过的专业 + 已交费测评的专业
   */
  async getPopularMajorEntitlementSummary(userId: number | null): Promise<{
    freeUsedMajorCodes: string[];
    paidMajorCodes: string[];
  }> {
    if (userId == null) {
      return { freeUsedMajorCodes: [], paidMajorCodes: [] };
    }
    const [freeUsedMajorCodes, paidMajorCodes] = await Promise.all([
      this.getFreeUsedMajorCodes(userId),
      this.getPaidMajorCodes(userId),
    ]);
    return { freeUsedMajorCodes, paidMajorCodes };
  }

  /** 根据 openid 解析 user_id（兼容旧调用方） */
  async getUserIdByOpenid(openid: string): Promise<number | null> {
    const user = await this.userRepository.findOne({ where: { openid }, select: ['id'] });
    return user?.id ?? null;
  }

  /**
   * 根据 user_id 从 Users 表查询 user_type（供 EntitlementGuard 判断是否 admin 放行）
   */
  async getUserTypeByUserId(userId: number): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['userType'],
    });
    return user?.userType ?? null;
  }

  /**
   * 根据热门专业 id 查询专业代码（供 EntitlementGuard 等使用，Guard 仅依赖 PayModule）
   */
  async getMajorCodeByPopularMajorId(popularMajorId: number): Promise<string | null> {
    const row = await this.popularMajorRepository.findOne({
      where: { id: popularMajorId },
      select: ['code'],
    });
    return row?.code ?? null;
  }

  /** 根据 user_id 解析 openid（如微信 JSAPI 预支付需 openid） */
  async getOpenidByUserId(userId: number): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['openid'],
    });
    return user?.openid ?? null;
  }

  private async getPaidMajorCodesByUserId(userId: number): Promise<string[]> {
    const list = await this.entitlementRepository.find({
      where: { user_id: userId, product_type: PRODUCT_TYPE_POPULAR_MAJOR },
      select: ['major_code'],
    });
    return list.map((e) => e.major_code).filter((c) => c !== '');
  }

  private async hasUnlockAllByUserId(userId: number): Promise<boolean> {
    const count = await this.entitlementRepository.count({
      where: { user_id: userId, product_type: PRODUCT_TYPE_UNLOCK_ALL, major_code: '' },
    });
    return count > 0;
  }

  /** 获取用户已付费的热门专业 code 列表 */
  async getPaidMajorCodes(userId: number | null): Promise<string[]> {
    if (userId == null) return [];
    return this.getPaidMajorCodesByUserId(userId);
  }

  /** 用户是否已购买「解锁全部」 */
  async hasUnlockAll(userId: number | null): Promise<boolean> {
    if (userId == null) return false;
    return this.hasUnlockAllByUserId(userId);
  }

  /**
   * 购买「解锁全部」时，已付热门专业可抵扣的金额（分）
   * 用于计算实付：299 元 - 已付热门专业总金额
   */
  async getUnlockAllDeductAmount(userId: number | null): Promise<number> {
    if (userId == null) return 0;
    const list = await this.entitlementRepository.find({
      where: { user_id: userId, product_type: PRODUCT_TYPE_POPULAR_MAJOR },
      select: ['amount'],
    });
    return list.reduce((sum, e) => sum + e.amount, 0);
  } 
  /**
   * 计算「解锁全部」实付金额（分）
   * 原价 299 元，减去已付热门专业总金额，最低 0
   */
  async getUnlockAllPayAmount(userId: number | null): Promise<number> {
    const deduct = await this.getUnlockAllDeductAmount(userId);
    return Math.max(0, PRICE_UNLOCK_ALL_CENTS - deduct);
  }

  /** 创建权益记录（支付回调时由 PaymentProcessor 调用）；仅存 user_id */
  async createEntitlement(
    userId: number,
    productType: 'popular_major' | 'unlock_all',
    majorCode: string,
    orderId: number,
    amount: number,
  ): Promise<UserEntitlement> {
    const code = productType === PRODUCT_TYPE_UNLOCK_ALL ? '' : majorCode;
    const ent = this.entitlementRepository.create({
      user_id: userId,
      product_type: productType,
      major_code: code,
      order_id: orderId,
      amount,
    });
    return this.entitlementRepository.save(ent);
  }

  /** 暴露常量供下单使用 */
  getPricePopularMajorCents(): number {
    return PRICE_POPULAR_MAJOR_CENTS;
  }
  getPriceUnlockAllCents(): number {
    return PRICE_UNLOCK_ALL_CENTS;
  }
}
