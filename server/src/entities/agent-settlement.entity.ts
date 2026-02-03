import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './agent.entity';

/**
 * 代理商分账记录
 * 记录每笔订单对代理的分账明细，便于对账与重试
 */
@Entity('agent_settlements')
@Index(['orderId'])
@Index(['agentId'])
@Index(['status'])
export class AgentSettlement {
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  /** 关联订单ID（对应 orders.id 或业务订单号） */
  @Column({ name: 'order_id', type: 'int', comment: '关联订单ID' })
  orderId: number;

  @Column({ name: 'agent_id', type: 'int', comment: '代理商ID' })
  agentId: number;

  /** 分账金额（单位：分） */
  @Column({ type: 'int', comment: '分账金额（单位：分）' })
  amount: number;

  /** 接收方类型：openid 个人零钱 / merchant 商户号 */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'receiver_type',
    comment: '接收方类型：openid 个人零钱 / merchant 商户号',
  })
  receiverType: string;

  /** 接收方标识：openid 或 merchant_id */
  @Column({
    type: 'varchar',
    length: 128,
    name: 'receiver_id',
    comment: '接收方标识：openid 或 merchant_id',
  })
  receiverId: string;

  /** 微信分账/转账单号 */
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    name: 'wx_detail_id',
    comment: '微信分账/转账单号',
  })
  wxDetailId: string | null;

  /** 状态：pending 待处理 / success 成功 / failed 失败 */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
    comment: '状态：pending 待处理 / success 成功 / failed 失败',
  })
  status: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => Agent, (agent) => agent.settlements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;
}
