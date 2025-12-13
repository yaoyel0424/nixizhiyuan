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
 * 象限挑战类型枚举
 */
export enum ChallengeType {
  SELF = '自我', // 自我类型
  INTERPERSONAL = '人际', // 人际类型
  COGNITIVE = '认知', // 认知类型
}

/**
 * 象限挑战实体类
 * 用于存储第一象限的挑战信息（双刃剑的挑战和应对策略）
 */
@Entity('quadrant_1_challenges')
export class QuadrantChallenge {
  /**
   * 挑战唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '挑战唯一标识符' })
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
   * 多对一关系：多个挑战可以关联到同一个肖像
   */
  @ManyToOne(() => Portrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait;

  /**
   * 挑战类型
   * 自我、人际、认知
   */
  @Column({
    type: 'varchar',
    length: 20,
    comment: '挑战类型（自我、人际、认知）',
  })
  type: string;

  /**
   * 挑战名称
   * 如："沉迷"vs."专注"
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '挑战名称',
  })
  name: string;

  /**
   * 挑战描述
   * 对该挑战的详细描述
   */
  @Column({
    type: 'text',
    comment: '挑战描述',
  })
  description: string;

  /**
   * 培养策略标题
   * 一念之间的即时心法标题
   */
  @Column({
    type: 'text',
    name: 'cultivation_strategy',
    comment: '培养策略标题（一念之间的即时心法）',
  })
  cultivationStrategy: string;

  /**
   * 即时策略
   * 化解双刃剑的即时心法
   */
  @Column({
    type: 'text',
    comment: '即时策略（化解双刃剑的即时心法）',
  })
  strategy: string;

  /**
   * 能力建设
   * 根除双刃剑的长期修炼方法
   */
  @Column({
    type: 'text',
    name: 'capability_building',
    comment: '能力建设（根除双刃剑的长期修炼方法）',
  })
  capabilityBuilding: string;

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

