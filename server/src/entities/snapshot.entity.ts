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

/**
 * 快照实体类
 * 用于存储用户在某一时刻的数据快照（如量表作答、画像结果等）
 */
@Entity('snapshots')
@Index(['userId', 'createdAt'])
@Index(['userId', 'type'])
export class Snapshot {
  @PrimaryGeneratedColumn({ comment: '快照唯一标识符' })
  id: number;

  @Index()
  @Column({ name: 'user_id', comment: '用户ID' })
  userId: number;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'type',
    comment: '快照类型，如 scale、portrait 等',
  })
  type: string;

  @Column({
    type: 'varchar',
    length: 32,
    name: 'version',
    comment: '快照版本，如 1、1.0、v2 等',
    default: '1',
  })
  version: string;

  /**
   * 快照内容，JSON 字符串存储
   */
  @Column({
    type: 'text',
    name: 'payload',
    comment: '快照内容（JSON）',
  })
  payload: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
