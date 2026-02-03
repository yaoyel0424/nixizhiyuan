import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Agent } from './agent.entity';

/**
 * 用户与代理商绑定关系
 * 用于记录用户由哪个代理带来，便于订单归属与分账
 */
@Entity('user_agent_binds')
@Index(['userId'])
@Index(['agentId'])
@Index(['userId', 'agentId'])
export class UserAgentBind {
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  @Column({ name: 'user_id', type: 'int', comment: '用户ID' })
  userId: number;

  @Column({ name: 'agent_id', type: 'int', comment: '代理商ID' })
  agentId: number;

  /** 绑定方式：qrcode 扫码 / link 链接 / manual 手动 */
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'bind_type',
    comment: '绑定方式：qrcode 扫码 / link 链接 / manual 手动',
  })
  bindType: string | null;

  @CreateDateColumn({ name: 'bind_at', comment: '绑定时间' })
  bindAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Agent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent: Agent;
}
