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
 * 第三象限弱点实体类
 * 用于存储第三象限的弱点信息（低喜欢&低天赋的挑战和应对策略）
 */
@Entity('quadrant_3_weaknesses')
export class Quadrant3Weakness {
  /**
   * 弱点唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '弱点唯一标识符' })
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
   * 多对一关系：多个弱点可以关联到同一个肖像
   */
  @ManyToOne(() => Portrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait;

  /**
   * 弱点类型
   * 如：自我接纳与内耗止损、人际协作与诚实外包、认知策略与工具替代等
   */
  @Column({
    type: 'varchar',
    length: 50,
    comment: '弱点类型',
  })
  type: string;

  /**
   * 弱点名称
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '弱点名称',
  })
  name: string;

  /**
   * 弱点描述
   * 对该弱点的详细描述
   */
  @Column({
    type: 'text',
    comment: '弱点描述',
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
   * 化解弱点的即时心法
   */
  @Column({
    type: 'text',
    comment: '即时策略（化解弱点的即时心法）',
  })
  strategy: string;

  /**
   * 能力建设
   * 根除弱点的长期修炼方法（可为空）
   */
  @Column({
    type: 'text',
    name: 'capability_building',
    nullable: true,
    comment: '能力建设（根除弱点的长期修炼方法）',
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

