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
 * 象限生态位实体类
 * 用于存储第一象限的生态位信息（基于肖像的核心价值生态位）
 */
@Entity('quadrant_1_niches')
export class QuadrantNiche {
  /**
   * 生态位唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '生态位唯一标识符' })
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
   * 多对一关系：多个生态位可以关联到同一个肖像
   */
  @ManyToOne(() => Portrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait;

  /**
   * 生态位标题
   * 如：自然世界的"解码者"与"代言人"
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '生态位标题',
  })
  title: string;

  /**
   * 生态位描述
   * 对该生态位的详细描述
   */
  @Column({
    type: 'text',
    comment: '生态位描述',
  })
  description: string;

  /**
   * 可能的角色
   * 该生态位下可能的职业角色
   */
  @Column({
    type: 'text',
    name: 'possible_roles',
    comment: '可能的角色（该生态位下可能的职业角色）',
  })
  possibleRoles: string;

  /**
   * 探索建议
   * 如何探索和体验该生态位的建议
   */
  @Column({
    type: 'text',
    name: 'exploration_suggestions',
    comment: '探索建议（如何探索和体验该生态位的建议）',
  })
  explorationSuggestions: string;

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

