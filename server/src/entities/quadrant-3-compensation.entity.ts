import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Portrait } from './portrait.entity';

/**
 * 第三象限补偿实体类
 * 用于存储第三象限的补偿策略信息（跨维度代偿和环境改造）
 */
@Entity('quadrant_3_compensations')
export class Quadrant3Compensation {
  /**
   * 补偿唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '补偿唯一标识符' })
  id: number;

  /**
   * 关联的肖像ID
   * 外键关联到 portraits 表的 id
   */
  @Column({
    type: 'int',
    name: 'portrait_id',
    comment: '关联的肖像ID',
  })
  portraitId: number;

  /**
   * 关联的肖像实体
   * 多对一关系：多个补偿可以关联到同一个肖像
   */
  @ManyToOne(() => Portrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait;

  /**
   * 补偿名称
   * 如：跨维度代偿、环境改造
   */
  @Column({
    type: 'varchar',
    length: 100,
    comment: '补偿名称',
  })
  name: string;

  /**
   * 补偿描述
   * 详细的补偿策略描述
   */
  @Column({
    type: 'text',
    comment: '补偿描述（详细的补偿策略描述）',
  })
  description: string;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({
    comment: '记录创建时间',
    name: 'created_at',
    select: false,
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({
    comment: '记录最后更新时间',
    name: 'updated_at',
    select: false,
  })
  updatedAt: Date;
}

