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
 * 第四象限困境实体类
 * 用于存储第四象限的困境信息（低喜欢&高天赋的挑战和应对策略）
 */
@Entity('quadrant_4_dilemmas')
export class Quadrant4Dilemma {
  /**
   * 困境唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '困境唯一标识符' })
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
   * 多对一关系：多个困境可以关联到同一个肖像
   */
  @ManyToOne(() => Portrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait;

  /**
   * 困境类型
   * 如：自我、人际、认知等
   */
  @Column({
    type: 'varchar',
    length: 50,
    comment: '困境类型',
  })
  type: string;

  /**
   * 困境名称
   * 如："过程愉悦"vs."结果挫败"、"内在动机"vs."外部评价"等
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '困境名称',
  })
  name: string;

  /**
   * 困境描述
   * 详细描述该困境的具体情况
   */
  @Column({
    type: 'text',
    comment: '困境描述',
  })
  description: string;

  /**
   * 培养策略
   * 应对该困境的培养策略概述
   */
  @Column({
    type: 'text',
    name: 'cultivation_strategy',
    comment: '培养策略',
  })
  cultivationStrategy: string;

  /**
   * 具体策略
   * 应对该困境的具体策略和方法
   */
  @Column({
    type: 'text',
    comment: '具体策略',
  })
  strategy: string;

  /**
   * 能力建设
   * 长期能力建设的建议和方法
   * 可为空
   */
  @Column({
    type: 'text',
    name: 'capability_building',
    nullable: true,
    comment: '能力建设',
  })
  capabilityBuilding: string | null;

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

