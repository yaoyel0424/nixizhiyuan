import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

/**
 * 订单实体类
 * 用于存储微信支付订单信息
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 32, comment: '商户号' })
  mchid: string;

  @Column({ length: 32, comment: '应用ID' })
  appid: string;

  @Column({ length: 32, unique: true, comment: '商户订单号' })
  out_trade_no: string;

  @Column({ length: 32, nullable: true, comment: '微信支付订单号' })
  transaction_id: string;

  @Column({ length: 16, comment: '交易类型' })
  trade_type: string;

  @Column({ length: 32, comment: '交易状态' })
  trade_state: string;

  @Column({ length: 256, comment: '交易状态描述' })
  trade_state_desc: string;

  @Column({ length: 32, comment: '付款银行' })
  bank_type: string;

  @Column({ length: 128, nullable: true, comment: '附加数据' })
  attach: string;

  @Column({ type: 'timestamp with time zone', comment: '支付成功时间' })
  success_time: Date;

  @Index('idx_orders_openid')
  @Column({ length: 128, comment: '用户标识' })
  openid: string;

  @Column({ type: 'integer', comment: '订单金额(分)' })
  total_amount: number;

  @Column({ type: 'integer', comment: '用户支付金额(分)' })
  payer_total: number;

  @Column({ length: 16, default: 'CNY', comment: '货币类型' })
  currency: string;

  @Column({ length: 16, default: 'CNY', comment: '用户支付币种' })
  payer_currency: string;

  @CreateDateColumn({ comment: '创建时间' })
  created_at: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updated_at: Date;

  // 添加与用户的多对一关联
  @ManyToOne(() => User, user => user.orders)
  @JoinColumn({ name: 'openid', referencedColumnName: 'openid' })
  user: User;
} 