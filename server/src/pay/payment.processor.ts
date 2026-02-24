import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '@/entities/order.entity';
import { RedisService } from '@/redis/redis.service';
import { EntitlementService } from './entitlement.service';
import { PayLoggerService } from './pay-logger.service';
import type { PaymentJobPayload, SplitJobPayload } from './pay.types';
import { PRODUCT_TYPE_POPULAR_MAJOR, PRODUCT_TYPE_UNLOCK_ALL } from './pay.constants';

const PAYMENT_QUEUE = 'payment';
const SPLIT_QUEUE = 'split';
const NOTIFY_DONE_TTL = 7 * 24 * 3600; // 7 天

@Processor(PAYMENT_QUEUE)
export class PaymentProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    private readonly redisService: RedisService,
    private readonly entitlementService: EntitlementService,
    private readonly logger: PayLoggerService,
    @InjectQueue(SPLIT_QUEUE) private readonly splitQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<PaymentJobPayload, any, string>): Promise<any> {
    try {
      return await this.processPaymentJob(job);
    } catch (err: any) {
      this.logger.error(
        `[PaymentProcessor] 处理失败 jobId=${job.id} transaction_id=${job.data?.transaction_id}: ${err?.message ?? err}`,
        err?.stack,
      );
      throw err;
    }
  }

  private async processPaymentJob(job: Job<PaymentJobPayload, any, string>): Promise<void> {
    if (job.name !== 'payment-success') return;
    const payload = job.data;
    const { transaction_id } = payload;

    const doneKey = `pay:notify:done:${transaction_id}`;
    const ok = await this.redisService.setNX(doneKey, '1', NOTIFY_DONE_TTL);
    if (!ok) {
      this.logger.log(`支付已处理过，跳过: ${transaction_id}`);
      return;
    }

    const order = new Order();
    order.mchid = payload.mchid;
    order.appid = payload.appid;
    order.out_trade_no = payload.out_trade_no;
    order.transaction_id = payload.transaction_id;
    order.trade_type = payload.trade_type;
    order.trade_state = payload.trade_state;
    order.trade_state_desc = payload.trade_state_desc;
    order.bank_type = payload.bank_type;
    order.attach = payload.attach ?? null;
    order.success_time = new Date(payload.success_time);
    order.openid = payload.openid;
    order.total_amount = payload.total;
    order.payer_total = payload.payer_total;
    order.currency = payload.currency;
    order.payer_currency = payload.payer_currency;
    order.split_status = 'pending';
    // 从 attach 解析代理/平台分账（示例：{"agentId":1,"agentAmount":100,"platformAmount":50}）
    try {
      if (payload.attach) {
        const att = JSON.parse(payload.attach);
        if (att.agentId != null) order.agent_id = Number(att.agentId);
        if (att.agentAmount != null) order.agent_amount = Number(att.agentAmount);
        if (att.platformAmount != null) order.platform_amount = Number(att.platformAmount);
      }
    } catch {
      // ignore
    }

    await this.orderRepository.save(order);
    this.logger.log('订单已保存: ' + order.out_trade_no);

    // 根据 attach 写入用户权益（热门专业 / 解锁全部）
    try {
      if (payload.attach) {
        const userId = await this.entitlementService.getUserIdByOpenid(payload.openid);
        if (userId == null) {
          this.logger.warn('支付回调: 无法根据 openid 解析 user_id，跳过权益写入');
        } else {
          const att = JSON.parse(payload.attach);
          const productType = att.productType;
          const majorCode = att.majorCode != null ? String(att.majorCode).trim() : '';
          if (productType === PRODUCT_TYPE_POPULAR_MAJOR && majorCode) {
            await this.entitlementService.createEntitlement(
              userId,
              'popular_major',
              majorCode,
              order.id,
              payload.total,
            );
            this.logger.log(`权益已记录: 热门专业 ${majorCode}, orderId=${order.id}`);
          } else if (productType === PRODUCT_TYPE_UNLOCK_ALL) {
            await this.entitlementService.createEntitlement(
              userId,
              'unlock_all',
              '',
              order.id,
              payload.total,
            );
            this.logger.log(`权益已记录: 解锁全部, orderId=${order.id}`);
          }
        }
      }
    } catch (e) {
      this.logger.warn('写入用户权益失败', e);
    }

    // 若有代理分账金额，则加入分账队列
    if (order.agent_id != null && (order.agent_amount ?? 0) > 0) {
      const receivers = this.buildReceivers(order, payload.attach);
      if (receivers.length > 0) {
        await this.splitQueue.add(
          'request-split',
          {
            transaction_id: order.transaction_id,
            order_id: order.id,
            out_trade_no: order.out_trade_no,
            receivers,
          },
          {
            jobId: order.transaction_id,
            removeOnComplete: { count: 500 },
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 },
          },
        );
      }
      this.logger.log('分账任务已入队: ' + order.transaction_id);
    }
  }

  /** 从订单与 attach 构建分账接收方列表；attach 可含 agentOpenid 用于个人分账 */
  private buildReceivers(
    order: Order,
    attach: string | null,
  ): SplitJobPayload['receivers'] {
    const list: SplitJobPayload['receivers'] = [];
    let agentOpenid: string | undefined;
    try {
      if (attach) {
        const att = JSON.parse(attach);
        agentOpenid = att.agentOpenid;
      }
    } catch {
      // ignore
    }
    if (order.agent_id != null && (order.agent_amount ?? 0) > 0 && agentOpenid) {
      list.push({
        type: 'PERSONAL_OPENID',
        openid: agentOpenid,
        amount: order.agent_amount!,
        description: '代理分账',
      });
    }
    if ((order.platform_amount ?? 0) > 0) {
      list.push({
        type: 'MERCHANT_ID',
        account: order.mchid,
        amount: order.platform_amount!,
        description: '平台留成',
      });
    }
    return list;
  }
}
