import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './agent.entity';

/**
 * 代理商商铺信息
 * 当代理商类型为 store 时，可在此表维护商铺名称、地址、商户号等
 */
@Entity('agent_stores')
@Index(['agentId'])
export class AgentStore {
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  @Column({ name: 'agent_id', type: 'int', comment: '所属代理商ID' })
  agentId: number;

  /** 店铺名称 */
  @Column({ type: 'varchar', length: 100, comment: '店铺名称' })
  name: string;

  /** 地址 */
  @Column({ type: 'varchar', length: 256, nullable: true, comment: '地址' })
  address: string | null;

  /** 店铺电话 */
  @Column({ type: 'varchar', length: 32, nullable: true, name: 'phone', comment: '店铺电话' })
  phone: string | null;

  /** 微信商户号（可与 agents.merchant_id 冗余或主存于此） */
  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
    name: 'merchant_id',
    comment: '微信商户号',
  })
  merchantId: string | null;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: '更新时间' })
  updatedAt: Date;

  @ManyToOne(() => Agent, (agent) => agent.stores, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;
}
