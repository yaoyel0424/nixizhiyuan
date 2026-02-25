import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PayService } from './pay.service';
import { EntitlementService } from './entitlement.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Order } from '@/entities/order.entity';
import { PayLoggerService } from './pay-logger.service';
import type { PaymentJobPayload } from './pay.types';
import { PRODUCT_TYPE_POPULAR_MAJOR, PRODUCT_TYPE_UNLOCK_ALL } from './pay.constants';

const PAYMENT_QUEUE = 'payment';
const PROFITSHARING_EVENT = 'PROFITSHARING';
const PROFITSHARING_RETURN_EVENT = 'PROFITSHARING_RETURN';

@ApiTags('支付')
@Controller('pay')
export class PayController {
  constructor(
    private readonly payService: PayService,
    private readonly entitlementService: EntitlementService,
    @InjectQueue(PAYMENT_QUEUE) private readonly paymentQueue: Queue,
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    private readonly logger: PayLoggerService,
  ) {}

  /**
   * 创建 JSAPI 预支付订单
   * 支持两种产品：popular_major（单个热门专业 29.9 元）、unlock_all（解锁全部 299 元，已付热门专业可抵扣）
   * 兼容旧版：仅传 amount 时按金额下单，不写权益 attach
   */
  @Get('transactions_jsapi')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建 JSAPI 预支付订单' })
  @ApiQuery({
    name: 'productType',
    required: false,
    description: '产品类型：popular_major / unlock_all；不传则使用 amount',
  })
  @ApiQuery({
    name: 'majorCode',
    required: false,
    description: '热门专业 code（productType=popular_major 时必传）',
  })
  @ApiQuery({
    name: 'amount',
    required: false,
    description: '金额（分），未传 productType 时必传',
  })
  async getTransactionsJsapi(
    @CurrentUser() user: any,
    @Query('productType') productType: string,
    @Query('majorCode') majorCode: string,
    @Query('amount') amount: string,
    @Req() req: Request,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('请先登录后再发起支付');
    }
    const userId = user.id;
    const openid = await this.entitlementService.getOpenidByUserId(userId);
    if (!openid) {
      throw new BadRequestException('未找到对应用户的 openid，无法发起支付');
    }
    const clientIp = (req as any).ip || req.socket?.remoteAddress || '';

    let amountNum: number;
    let attach: string | undefined;

    if (productType === PRODUCT_TYPE_POPULAR_MAJOR) {
      if (!majorCode || !majorCode.trim()) {
        throw new BadRequestException('购买单个热门专业时 majorCode 必填');
      }
      const access = await this.entitlementService.checkEntitlement(userId, majorCode.trim());
      if (access.allowed) {
        const msg =
          access.reason === 'unlock_all'
            ? '您已解锁全部，热门专业已包含在内，无需单独购买'
            : '您已拥有该专业权益（已购买或已使用免费额度），无需重复购买';
        throw new BadRequestException(msg);
      }
      amountNum = this.entitlementService.getPricePopularMajorCents();
      attach = JSON.stringify({
        productType: PRODUCT_TYPE_POPULAR_MAJOR,
        majorCode: majorCode.trim(),
      });
    } else if (productType === PRODUCT_TYPE_UNLOCK_ALL) {
      const hasUnlockAll = await this.entitlementService.hasUnlockAll(userId);
      if (hasUnlockAll) {
        throw new BadRequestException('您已解锁全部，无需重复购买（热门专业已包含在内）');
      }
      amountNum = await this.entitlementService.getUnlockAllPayAmount(userId);
      if (amountNum <= 0) {
        throw new BadRequestException('您已满足解锁全部条件，已为您解锁（热门专业已包含在内）');
      }
      attach = JSON.stringify({ productType: PRODUCT_TYPE_UNLOCK_ALL });
    } else {
      if (!amount) {
        throw new BadRequestException('请传 productType+majorCode 或 amount');
      }
      amountNum = Number.parseInt(amount, 10);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        throw new BadRequestException('amount 必须为正整数（分）');
      }
    }

    const result = await this.payService.createJsapiPrepay(
      openid,
      amountNum,
      clientIp,
      '逆袭智愿',
      attach,
    );
    return result;
  }

  /**
   * 检查用户是否可查看某热门专业（不消耗免费额度）
   */
  @Get('can-view')
  @ApiBearerAuth()
  @ApiOperation({ summary: '检查是否可查看热门专业' })
  @ApiQuery({ name: 'majorCode', required: true })
  async canView(
    @CurrentUser() user: any,
    @Query('majorCode') majorCode: string,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('请先登录');
    }
    if (!majorCode) {
      throw new BadRequestException('majorCode 必填');
    }
    return this.entitlementService.checkEntitlement(user.id, majorCode.trim());
  }

  /**
   * 判断对某热门专业是否拥有免费权益（当前可用免费额度查看，即 reason 为 free_quota）
   */
  @Get('free-entitlement')
  @ApiBearerAuth()
  @ApiOperation({ summary: '判断是否拥有免费权益（可用免费额度查看该热门专业）' })
  @ApiQuery({ name: 'majorCode', required: true, description: '热门专业代码' })
  async getFreeEntitlement(
    @CurrentUser() user: any,
    @Query('majorCode') majorCode: string,
  ): Promise<{ hasFreeEntitlement: boolean }> {
    if (!user?.id) {
      throw new UnauthorizedException('请先登录');
    }
    if (!majorCode) {
      throw new BadRequestException('majorCode 必填');
    }
    const access = await this.entitlementService.checkEntitlement(
      user.id,
      majorCode.trim(),
    );
    const hasFreeEntitlement =
      access.allowed === true && access.reason === 'free_quota';
    return { hasFreeEntitlement };
  }

  /**
   * 获取「解锁全部」应付金额（分）及抵扣说明
   */
  @Get('unlock-all-amount')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取解锁全部应付金额（已付热门专业可抵扣）' })
  async getUnlockAllAmount(@CurrentUser() user: any) {
    if (!user?.id) {
      throw new UnauthorizedException('请先登录');
    }
    const payAmount = await this.entitlementService.getUnlockAllPayAmount(user.id);
    const deductAmount = await this.entitlementService.getUnlockAllDeductAmount(user.id);
    return {
      amountCents: payAmount,
      deductCents: deductAmount,
      hasUnlockAll: payAmount <= 0,
    };
  }

  /**
   * 查询用户免费额度使用情况（验证是否已用完两个免费额度）
   */
  @Get('free-quota')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询免费额度使用情况' })
  async getFreeQuota(@CurrentUser() user: any) {
    if (!user?.id) {
      throw new UnauthorizedException('请先登录');
    }
    const info = await this.entitlementService.getFreeQuotaInfo(user.id);
    // const usedAll = await this.entitlementService.hasUsedAllFreeQuota(user.id);
    return { ...info };
  }

  /**
   * 热门专业权益汇总：用户 2 个免费权益使用的专业 + 已交费测评的专业
   */
  @Get('popular-major-entitlement-summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: '热门专业权益汇总（免费使用过的专业 + 已交费测评的专业）' })
  async getPopularMajorEntitlementSummary(@CurrentUser() user: any) {
    if (!user?.id) {
      throw new UnauthorizedException('请先登录');
    }
    return this.entitlementService.getPopularMajorEntitlementSummary(user.id);
  }

  /**
   * 微信支付 / 退款回调；解密后投递到 payment 队列异步处理，立即返回 200
   */
  @Post('notify')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '支付回调（微信服务器调用）' })
  async notify(@Body() body: any) {
    this.logger.log('收到支付回调');
    const result = this.payService.decryptNotify(body);
    if (!result) {
      this.logger.warn('支付回调解密失败或非支付成功事件');
      return { code: 'FAIL', message: '无效回调' };
    }
    const payload: PaymentJobPayload = {
      transaction_id: result.transaction_id,
      out_trade_no: result.out_trade_no,
      mchid: result.mchid,
      appid: result.appid,
      trade_type: result.trade_type,
      trade_state: result.trade_state,
      trade_state_desc: result.trade_state_desc,
      bank_type: result.bank_type,
      attach: result.attach || null,
      success_time: result.success_time,
      openid: result.payer.openid,
      total: result.amount.total,
      payer_total: result.amount.payer_total,
      currency: result.amount.currency,
      payer_currency: result.amount.payer_currency,
    };
    await this.paymentQueue.add('payment-success', payload, {
      jobId: result.transaction_id,
      removeOnComplete: { count: 1000 },
    });
    this.logger.log('支付回调已入队: ' + result.transaction_id);
    return { code: 'SUCCESS', message: '成功' };
  }

  /**
   * 分账动账通知（微信服务器调用）
   * 验签与解密后根据 out_order_no（本系统为 S{order_id}）更新订单分账状态
   */
  @Post('notify/split')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '分账动账通知回调' })
  async notifySplit(@Body() body: any) {
    this.logger.log('收到分账动账通知');
    if (
      body?.resource_type !== 'encrypt-resource' ||
      !body?.resource?.ciphertext
    ) {
      return { code: 'FAIL', message: '无效回调' };
    }
    const eventType = body.event_type;
    if (eventType !== PROFITSHARING_EVENT && eventType !== PROFITSHARING_RETURN_EVENT) {
      return { code: 'FAIL', message: '非分账事件' };
    }
    const decrypted = this.payService.decryptResource(
      body.resource.ciphertext,
      body.resource.associated_data || '',
      body.resource.nonce,
    );
    if (!decrypted) {
      return { code: 'FAIL', message: '解密失败' };
    }
    const outOrderNo = decrypted.out_order_no as string | undefined;
    const state = decrypted.state as string | undefined;
    if (!outOrderNo || !state) {
      this.logger.warn('分账回调缺少 out_order_no 或 state');
      return { code: 'SUCCESS', message: '成功' };
    }
    const orderIdMatch = outOrderNo.match(/^S(\d+)$/);
    if (orderIdMatch) {
      const orderId = parseInt(orderIdMatch[1], 10);
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (order) {
        order.split_status = state === 'SUCCESS' ? 'success' : 'failed';
        if (state === 'SUCCESS') order.split_at = new Date();
        await this.orderRepository.save(order);
        this.logger.log(`分账回调已更新订单 ${orderId} split_status=${order.split_status}`);
      }
    }
    return { code: 'SUCCESS', message: '成功' };
  }
}
