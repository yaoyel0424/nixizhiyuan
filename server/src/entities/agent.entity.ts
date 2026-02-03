import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { UserAgentBind } from './user-agent-bind.entity';
import { AgentStore } from './agent-store.entity';
import { AgentSettlement } from './agent-settlement.entity';

/**
 * 代理商实体
 * 支持个人代理（openid 分账到零钱）与商铺代理（merchant_id 分账到商户）
 */
@Entity('agents')
@Index(['type'])
@Index(['status'])
export class Agent {
  @PrimaryGeneratedColumn({ comment: '代理商主键' })
  id: number;

  /** 类型：personal 个人 / store 商铺 */
  @Column({
    type: 'varchar',
    length: 20,
    comment: '类型：personal 个人 / store 商铺',
  })
  type: 'personal' | 'store';

  /** 姓名或商铺名称 */
  @Column({ type: 'varchar', length: 100, comment: '姓名或商铺名称' })
  name: string;

  /** 联系电话 */
  @Column({ type: 'varchar', length: 32, nullable: true, comment: '联系电话' })
  phone: string | null;

  /** 个人代理的微信 openid（分账到零钱用） */
  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    name: 'openid',
    comment: '个人代理的微信 openid（分账到零钱用）',
  })
  openid: string | null;

  /** 商铺代理的微信商户号（分账到商户用） */
  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    name: 'merchant_id',
    comment: '商铺代理的微信商户号（分账到商户用）',
  })
  merchantId: string | null;

  /** 分账比例，如 0.1 表示 10% */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 4,
    default: 0,
    name: 'split_ratio',
    comment: '分账比例，如 0.1 表示 10%',
  })
  splitRatio: number;

  /** 状态：active 启用 / inactive 禁用 */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
    comment: '状态：active 启用 / inactive 禁用',
  })
  status: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @OneToMany(() => UserAgentBind, (bind) => bind.agent)
  userBinds: UserAgentBind[];

  @OneToMany(() => AgentStore, (store) => store.agent)
  stores: AgentStore[];

  @OneToMany(() => AgentSettlement, (s) => s.agent)
  settlements: AgentSettlement[];
}
