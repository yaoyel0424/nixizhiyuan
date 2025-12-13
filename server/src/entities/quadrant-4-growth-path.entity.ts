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
 * 第四象限成长路径实体类
 * 用于存储第四象限的成长路径信息（低喜欢&高天赋的发展方向）
 */
@Entity('quadrant_4_growth_paths')
export class Quadrant4GrowthPath {
  /**
   * 成长路径唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '成长路径唯一标识符' })
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
   * 多对一关系：多个成长路径可以关联到同一个肖像
   */
  @ManyToOne(() => Portrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait;

  /**
   * 成长路径标题
   * 如：成为"自然世界的'解码者'与'代言人'"等
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '成长路径标题',
  })
  title: string;

  /**
   * 成长路径描述
   * 详细描述该成长路径的核心任务和目标
   */
  @Column({
    type: 'text',
    comment: '成长路径描述',
  })
  description: string;

  /**
   * 可能的角色
   * 该成长路径可能对应的职业角色
   */
  @Column({
    type: 'text',
    name: 'possible_roles',
    comment: '可能的角色',
  })
  possibleRoles: string;

  /**
   * 探索建议
   * 具体的探索和实践建议
   */
  @Column({
    type: 'text',
    name: 'exploration_suggestions',
    comment: '探索建议',
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

