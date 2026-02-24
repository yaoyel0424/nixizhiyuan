import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { User } from './user.entity';

/**
 * 用户付费权益：记录用户已购买的热门专业或「解锁全部」
 * 仅使用 user_id 关联 users 表，用于判断是否可查看某热门专业、以及解锁全部时的抵扣金额
 */
@Entity('user_entitlements')
@Index(['user_id', 'product_type', 'major_code'], { unique: true })
export class UserEntitlement {
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  @Column({ name: 'user_id', type: 'int', comment: '用户 id，外键关联 users.id' })
  user_id: number;

  /** 产品类型：popular_major 单个热门专业，unlock_all 一次性解锁全部 */
  @Column({
    name: 'product_type',
    length: 32,
    comment: '产品类型：popular_major / unlock_all',
  })
  product_type: 'popular_major' | 'unlock_all';

  /** 热门专业代码（popular_major 时存 code，unlock_all 存空字符串以保证唯一约束） */
  @Column({
    name: 'major_code',
    length: 20,
    default: '',
    comment: '热门专业代码（popular_major 时有值，unlock_all 为空串）',
  })
  major_code: string;

  @Column({ name: 'order_id', type: 'int', comment: '关联订单 id' })
  order_id: number;

  @Column({ type: 'integer', comment: '支付金额（分）' })
  amount: number;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  created_at: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
