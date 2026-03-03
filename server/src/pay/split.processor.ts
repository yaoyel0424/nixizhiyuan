import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '@/entities/order.entity';
import { RedisService } from '@/redis/redis.service';
import { PayService } from './pay.service';
import { PayLoggerService } from './pay-logger.service';
import type { SplitJobPayload } from './pay.types';

const SPLIT_QUEUE = 'split';

/**
 * 分账队列消费者：请求微信分账并更新订单分账状态
 * 分账完成标记（Redis split:request:done:*）与订单表 split_status/split_at 均永久保留
 */
@Processor(SPLIT_QUEUE)
export class SplitProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Order) private readonly orderRepository: Repository<Order>,
    private readonly redisService: RedisService,
    private readonly payService: PayService,
    private readonly logger: PayLoggerService,
  ) {
    super();
  }

  async process(job: Job<SplitJobPayload, any, string>): Promise<any> {
    this.logger.log(
      `[SplitProcessor] process jobId=${job.id} name=${job.name} dataKeys=${Object.keys(job.data || {}).join(',')}`,
    );
    if (job.name !== 'request-split') return;
    const { transaction_id, order_id, out_trade_no, receivers } = job.data;
    this.logger.log(`[SplitProcessor] 开始处理 transaction_id=${transaction_id} order_id=${order_id} receivers.length=${receivers?.length ?? 0}`);
    const doneKey = `split:request:done:${transaction_id}`;

    const order = await this.orderRepository.findOne({ where: { id: order_id } });
    if (!order) {
      this.logger.warn(`订单不存在: ${order_id}`);
      return;
    }
    if (order.split_status === 'success') {
      await this.redisService.set(doneKey, '1');
      return;
    }

    if (!receivers || receivers.length === 0) {
      this.logger.warn(`分账接收方为空: ${transaction_id}`);
      order.split_status = 'failed';
      await this.orderRepository.save(order);
      return;
    }

    try {
      const outOrderNo = `S${order_id}`;
      await this.payService.createProfitsharingOrders(
        transaction_id,
        outOrderNo,
        receivers,
      );
      await this.redisService.set(doneKey, '1');
      order.split_status = 'success';
      order.split_at = new Date();
      await this.orderRepository.save(order);
      this.logger.log(`分账成功: ${transaction_id}, 分账单号: ${outOrderNo}`);
    } catch (e: any) {
      // 记录详细错误信息便于排查（微信 API 错误通常在 e.response?.data 或 e.message）
      const errMsg = e?.message ?? String(e);
      const wxErr = e?.response?.data;
      const errDetail = wxErr
        ? ` code=${wxErr.code} message=${wxErr.message}`
        : ` ${errMsg}`;
      this.logger.error(`分账处理失败: ${transaction_id}${errDetail}`, e?.stack ?? e);
      order.split_status = 'failed';
      await this.orderRepository.save(order);
      throw e;
    }
  }
}
