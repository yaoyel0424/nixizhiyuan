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
const SPLIT_DONE_TTL = 30 * 24 * 3600; // 30 天

/**
 * 分账队列消费者：请求微信分账并更新订单分账状态
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
    if (job.name !== 'request-split') return;
    const { transaction_id, order_id, out_trade_no, receivers } = job.data;
    const doneKey = `split:request:done:${transaction_id}`;

    const order = await this.orderRepository.findOne({ where: { id: order_id } });
    if (!order) {
      this.logger.warn(`订单不存在: ${order_id}`);
      return;
    }
    if (order.split_status === 'success') {
      await this.redisService.set(doneKey, '1', SPLIT_DONE_TTL);
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
      await this.redisService.set(doneKey, '1', SPLIT_DONE_TTL);
      order.split_status = 'success';
      order.split_at = new Date();
      await this.orderRepository.save(order);
      this.logger.log(`分账成功: ${transaction_id}, 分账单号: ${outOrderNo}`);
    } catch (e) {
      this.logger.error('分账处理失败: ' + transaction_id, e);
      order.split_status = 'failed';
      await this.orderRepository.save(order);
      throw e;
    }
  }
}
