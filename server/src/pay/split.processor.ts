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

/** 发起分账后等待多久再查询结果（毫秒） */
const QUERY_DELAY_MS = 2000;
/** 若首次查询为处理中，再等多久重试一次（毫秒） */
const QUERY_RETRY_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 分账队列消费者：请求微信分账后主动查询分账结果并更新订单状态（发起方收不到回调时使用）
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
    this.logger.log(
      `[SplitProcessor] 开始处理 transaction_id=${transaction_id} order_id=${order_id} receivers.length=${receivers?.length ?? 0} receivers=${JSON.stringify(receivers ?? [])}`,
    );
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

      await sleep(QUERY_DELAY_MS);
      let result = await this.payService.queryProfitsharingOrder(transaction_id, outOrderNo);
      if (result && (result.status === 'PROCESSING' || result.status === 'ACCEPTED')) {
        await sleep(QUERY_RETRY_DELAY_MS);
        result = await this.payService.queryProfitsharingOrder(transaction_id, outOrderNo);
      }

      if (result) {
        if (result.status === 'FINISHED') {
          order.split_status = 'success';
          order.split_at = new Date();
          await this.orderRepository.save(order);
          this.logger.log(`分账成功(主动查询): ${transaction_id}, 分账单号: ${outOrderNo}`);
        } else if (result.status === 'CLOSED') {
          order.split_status = 'failed';
          await this.orderRepository.save(order);
          this.logger.warn(`分账关闭(主动查询): ${transaction_id} status=${result.status}`);
        } else {
          this.logger.log(
            `分账处理中(主动查询): ${transaction_id} status=${result.status}，订单状态未更新，可依赖回调或后续重试`,
          );
        }
      } else {
        this.logger.warn(`查询分账结果失败: ${transaction_id}，订单状态未更新`);
      }
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
