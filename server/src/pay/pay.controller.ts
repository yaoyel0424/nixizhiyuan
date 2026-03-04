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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
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
import { EntitlementGuard } from '@/common/guards/entitlement.guard';
import { RequireEntitlement } from '@/common/decorators/require-entitlement.decorator';
import { UsersService } from '@/users/users.service';

const PAYMENT_QUEUE = 'payment';
const SPLIT_QUEUE = 'split';
const PROFITSHARING_EVENT = 'PROFITSHARING';
const PROFITSHARING_RETURN_EVENT = 'PROFITSHARING_RETURN';

@ApiTags('支付')
@Controller('pay')
export class PayController {
  constructor(
    private readonly payService: PayService,
    private readonly entitlementService: EntitlementService,
    private readonly usersService: UsersService,
    @InjectQueue(PAYMENT_QUEUE) private readonly paymentQueue: Queue,
    @InjectQueue(SPLIT_QUEUE) private readonly splitQueue: Queue,
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
    const userInfo = await this.usersService.findOneWithAgent(userId);
    if (!userInfo.openid) {
      throw new BadRequestException('未找到对应用户的 openid，无法发起支付');
    }
    const agentOpenid = userInfo.agent?.openid ?? undefined;

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
        ...(userInfo.agentId != null && { agentId: userInfo.agentId }),
        ...(agentOpenid && { agentOpenid }),
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
      const hasAgent = userInfo.agentId != null || agentOpenid;
      const agentAmount = hasAgent ? Math.round(amountNum * 0.3) : undefined;
      attach = JSON.stringify({
        productType: PRODUCT_TYPE_UNLOCK_ALL,
        ...(userInfo.agentId != null && { agentId: userInfo.agentId }),
        ...(agentOpenid && { agentOpenid }),
        ...(agentAmount != null && { agentAmount }),
      });
    } else {
      if (!amount) {
        throw new BadRequestException('请传 productType+majorCode 或 amount');
      }
      amountNum = Number.parseInt(amount, 10);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        throw new BadRequestException('amount 必须为正整数（分）');
      }
      if (userInfo.agentId != null || agentOpenid) {
        attach = JSON.stringify({
          ...(userInfo.agentId != null && { agentId: userInfo.agentId }),
          ...(agentOpenid && { agentOpenid }),
        });
      }
    }

    const result = await this.payService.createJsapiPrepay(
      userInfo.openid,
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
  @UseGuards(EntitlementGuard) 
  async getFreeQuota(@CurrentUser() user: any, @Req() req: Request) {
    if (!user?.id) {
      throw new UnauthorizedException('请先登录');
    }
    const hasUnlockAll = (req as any).hasUnlockAll ?? false;
  
    const info = await this.entitlementService.getFreeQuotaInfo(user.id);
    // const usedAll = await this.entitlementService.hasUsedAllFreeQuota(user.id);
    return { ...info,hasUnlockAll: hasUnlockAll };
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
      removeOnComplete: false,
    });
    this.logger.log('支付回调已入队: ' + result.transaction_id);
    return { code: 'SUCCESS', message: '成功' };
  }

  /**
   * 查看 payment 队列中已成功执行的 job 列表（分页，0-based start/end）
   */
  @Get('queue/completed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查看支付队列已成功执行的数据' })
  @ApiQuery({ name: 'start', required: false, description: '起始下标（从 0 开始）', example: 0 })
  @ApiQuery({ name: 'end', required: false, description: '结束下标（不包含），默认 99', example: 99 })
  async getQueueCompleted(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startNum = start !== undefined ? parseInt(start, 10) : 0;
    const endNum = end !== undefined ? parseInt(end, 10) : 99;
    const [jobs, total] = await Promise.all([
      this.paymentQueue.getCompleted(
        Number.isNaN(startNum) ? 0 : startNum,
        Number.isNaN(endNum) ? 99 : endNum,
      ),
      this.paymentQueue.getCompletedCount(),
    ]);
    const items = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    }));
    return { total, start: startNum, end: endNum, items };
  }

  /**
   * 查看 payment 队列中执行失败的 job 列表（分页，0-based start/end）
   */
  @Get('queue/failed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查看支付队列执行失败的数据' })
  @ApiQuery({ name: 'start', required: false, description: '起始下标（从 0 开始）', example: 0 })
  @ApiQuery({ name: 'end', required: false, description: '结束下标（不包含），默认 99', example: 99 })
  async getQueueFailed(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startNum = start !== undefined ? parseInt(start, 10) : 0;
    const endNum = end !== undefined ? parseInt(end, 10) : 99;
    const [jobs, total] = await Promise.all([
      this.paymentQueue.getFailed(
        Number.isNaN(startNum) ? 0 : startNum,
        Number.isNaN(endNum) ? 99 : endNum,
      ),
      this.paymentQueue.getFailedCount(),
    ]);
    const items = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
    }));
    return { total, start: startNum, end: endNum, items };
  }

  /**
   * 查看分账队列中已成功执行的 job 列表（Redis 分账成功数据，分页）
   */
  @Get('split/queue/completed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查看分账队列已成功执行的数据' })
  @ApiQuery({ name: 'start', required: false, description: '起始下标（从 0 开始）', example: 0 })
  @ApiQuery({ name: 'end', required: false, description: '结束下标（不包含），默认 99', example: 99 })
  async getSplitQueueCompleted(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startNum = start !== undefined ? parseInt(start, 10) : 0;
    const endNum = end !== undefined ? parseInt(end, 10) : 99;
    const [jobs, total] = await Promise.all([
      this.splitQueue.getCompleted(
        Number.isNaN(startNum) ? 0 : startNum,
        Number.isNaN(endNum) ? 99 : endNum,
      ),
      this.splitQueue.getCompletedCount(),
    ]);
    const items = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    }));
    return { total, start: startNum, end: endNum, items };
  }

  /**
   * 查看分账队列中执行失败的 job 列表（Redis 分账失败数据，分页）
   */
  @Get('split/queue/failed')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查看分账队列执行失败的数据' })
  @ApiQuery({ name: 'start', required: false, description: '起始下标（从 0 开始）', example: 0 })
  @ApiQuery({ name: 'end', required: false, description: '结束下标（不包含），默认 99', example: 99 })
  async getSplitQueueFailed(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const startNum = start !== undefined ? parseInt(start, 10) : 0;
    const endNum = end !== undefined ? parseInt(end, 10) : 99;
    const [jobs, total] = await Promise.all([
      this.splitQueue.getFailed(
        Number.isNaN(startNum) ? 0 : startNum,
        Number.isNaN(endNum) ? 99 : endNum,
      ),
      this.splitQueue.getFailedCount(),
    ]);
    const items = jobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      finishedOn: job.finishedOn,
    }));
    return { total, start: startNum, end: endNum, items };
  }

  /**
   * 分账账单查询：调微信「查询分账结果」接口，返回分账状态及接收方明细
   * 传 order_id 或 (transaction_id + out_order_no) 二选一
   */
  @Get('split/order')
  @ApiBearerAuth()
  @ApiOperation({ summary: '分账账单查询' })
  @ApiQuery({ name: 'order_id', required: false, description: '订单 ID，传入则用该订单的 transaction_id 与分账单号 S{order_id} 查询' })
  @ApiQuery({ name: 'transaction_id', required: false, description: '微信支付订单号，与 out_order_no 同时传入' })
  @ApiQuery({ name: 'out_order_no', required: false, description: '商户分账单号（如 S86），与 transaction_id 同时传入' })
  async getSplitOrder(
    @Query('order_id') orderIdStr?: string,
    @Query('transaction_id') transactionId?: string,
    @Query('out_order_no') outOrderNo?: string,
  ) {
    let transaction_id: string;
    let out_order_no: string;

    if (orderIdStr != null && orderIdStr !== '') {
      const orderId = parseInt(orderIdStr, 10);
      if (Number.isNaN(orderId) || orderId < 1) {
        throw new BadRequestException('order_id 无效');
      }
      const order = await this.orderRepository.findOne({ where: { id: orderId } });
      if (!order) {
        throw new BadRequestException(`订单不存在: ${orderId}`);
      }
      if (!order.transaction_id) {
        throw new BadRequestException(`订单 ${orderId} 无微信支付订单号，无法查询分账`);
      }
      transaction_id = order.transaction_id;
      out_order_no = `S${orderId}`;
    } else if (transactionId?.trim() && outOrderNo?.trim()) {
      transaction_id = transactionId.trim();
      out_order_no = outOrderNo.trim();
    } else {
      throw new BadRequestException('请传 order_id 或同时传 transaction_id 与 out_order_no');
    }

    const result = await this.payService.queryProfitsharingOrder(transaction_id, out_order_no);
    if (result == null) {
      return { ok: false, message: '查询分账结果失败或未返回数据', data: null };
    }
    return { ok: true, data: result };
  }

  /**
   * 手工添加分账接收方（请求分账前需先建立接收方关系，PERSONAL_OPENID 时 account 为 openid）
   * 接收方已存在时视为成功（幂等）
   */
  @Post('split/receiver')
  @ApiBearerAuth()
  @ApiOperation({ summary: '手工添加分账接收方' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['type', 'account'],
      properties: {
        type: { type: 'string', description: '接收方类型：PERSONAL_OPENID（个人 openid）、MERCHANT_ID（商户号）' },
        account: { type: 'string', description: '接收方账号：PERSONAL_OPENID 时填用户 openid，MERCHANT_ID 时填商户号' },
        relationType: { type: 'string', description: '关系类型，默认 SERVICE_PROVIDER；可选 CUSTOM 时需传 customRelation' },
        customRelation: { type: 'string', description: 'relationType 为 CUSTOM 时的自定义关系说明' },
      },
    },
  })
  async addSplitReceiver(
    @Body() body: { type: string; account: string; relationType?: string; customRelation?: string },
  ) {
    const { type, account } = body ?? {};
    if (!type?.trim() || !account?.trim()) {
      throw new BadRequestException('请传 type 与 account');
    }
    if (type !== 'PERSONAL_OPENID' && type !== 'MERCHANT_ID') {
      throw new BadRequestException('type 仅支持 PERSONAL_OPENID 或 MERCHANT_ID');
    }
    try {
      await this.payService.addProfitsharingReceiver(
        type.trim(),
        account.trim(),
        body.relationType?.trim() || 'SERVICE_PROVIDER',
        body.customRelation?.trim(),
      );
      return { ok: true, message: '添加成功（若接收方已存在则视为成功）' };
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      throw new BadRequestException(msg || '添加分账接收方失败');
    }
  }

  /**
   * 将失败的分账任务重新入队（从 split 队列的 failed 列表取出，按原 payload 重新加入 waiting）
   * 不传 body 时重入队当前失败列表（最多 100 条）；传 transaction_id 时仅重入队该笔
   */
  @Post('split/requeue')
  @ApiBearerAuth()
  @ApiOperation({ summary: '失败分账重新入队' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: { transaction_id: { type: 'string', description: '微信支付订单号，不传则重入队所有失败任务（最多 100）' } },
    },
  })
  async requeueSplitFailed(@Body() body?: { transaction_id?: string }) {
    const transactionId = body?.transaction_id?.trim();
    const addOpts = {
      removeOnComplete: { count: 500 },
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
    };
    const requeuedIds: string[] = [];

    if (transactionId) {
      const job = await this.splitQueue.getJob(transactionId);
      if (!job) {
        throw new BadRequestException(`未找到 job: ${transactionId}`);
      }
      const state = await job.getState();
      if (state !== 'failed') {
        throw new BadRequestException(`job ${transactionId} 状态为 ${state}，仅支持重入队 failed 任务`);
      }
      const data = job.data as { transaction_id: string; order_id: number; out_trade_no: string; receivers: any[] };
      await job.remove();
      await this.splitQueue.add('request-split', data, { jobId: data.transaction_id, ...addOpts });
      requeuedIds.push(data.transaction_id);
      this.logger.log(`[分账] 已重入队 transaction_id=${data.transaction_id}`);
      return { requeued: 1, ids: requeuedIds };
    }

    const jobs = await this.splitQueue.getFailed(0, 99);
    for (const job of jobs) {
      const data = job.data as { transaction_id: string; order_id: number; out_trade_no: string; receivers: any[] };
      if (!data?.transaction_id || !data?.receivers?.length) continue;
      await job.remove();
      await this.splitQueue.add('request-split', data, { jobId: data.transaction_id, ...addOpts });
      requeuedIds.push(data.transaction_id);
    }
    this.logger.log(`[分账] 已重入队 ${requeuedIds.length} 个失败任务`);
    return { requeued: requeuedIds.length, ids: requeuedIds };
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
