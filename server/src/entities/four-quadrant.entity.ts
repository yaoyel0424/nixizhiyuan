import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 四象限实体类
 * 用于存储用户测评的四象限信息（基于喜欢和天赋的明显程度划分）
 */
@Entity('four_quadrants')
export class FourQuadrant {
  /**
   * 象限唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '象限唯一标识符' })
  id: number;

  /**
   * 象限编号
   * 1: 第一象限（喜欢明显，天赋明显）
   * 2: 第二象限（喜欢不明显，天赋明显）
   * 3: 第三象限（喜欢不明显，天赋不明显）
   * 4: 第四象限（喜欢明显，天赋不明显）
   */
  @Column({
    type: 'int',
    comment: '象限编号（1-4）',
  })
  quadrants: number;

  /**
   * 象限名称
   * 如：第一象限、第二象限、第三象限、第四象限
   */
  @Column({
    type: 'varchar',
    length: 50,
    comment: '象限名称',
  })
  name: string;

  /**
   * 喜欢是否明显
   * true: 喜欢明显
   * false: 喜欢不明显
   */
  @Column({
    type: 'boolean',
    name: 'like_obvious',
    comment: '喜欢是否明显',
  })
  likeObvious: boolean;

  /**
   * 天赋是否明显
   * true: 天赋明显
   * false: 天赋不明显
   */
  @Column({
    type: 'boolean',
    name: 'talent_obvious',
    comment: '天赋是否明显',
  })
  talentObvious: boolean;

  /**
   * 象限标题
   * 该象限的主要标题描述
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '象限标题',
  })
  title: string;

  /**
   * 第一部分标题
   * 该象限第一部分的标题
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'part_one_title',
    comment: '第一部分标题',
  })
  partOneTitle: string;

  /**
   * 第二部分标题
   * 该象限第二部分的标题
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'part_two_title',
    comment: '第二部分标题',
  })
  partTwoTitle: string;

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

