import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { SchoolDetail } from './school-detail.entity';
import { MajorDetail } from './major-detail.entity';

/**
 * 学校专业排名实体类
 * 用于存储各个学校不同专业的排名信息
 */
@Entity('school_major_ranks')
@Index(['school_code', 'major_code']) // 创建联合索引提高查询性能
export class SchoolMajorRank {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn({ comment: '排名记录唯一标识符' })
  id: number;

  /**
   * 轮次信息
   */
  @Column({
    type: 'varchar',
    length: 32,
    comment: '排名轮次'
  })
  round: string;

  /**
   * 学校代码
   */
  @Column({
    name: 'school_code',
    type: 'varchar',
    length: 50,
    comment: '学校代码'
  })
  school_code: string;

  /**
   * 学科名称
   */
  @Column({
    name: 'xueke_name',
    type: 'varchar',
    length: 256,
    comment: '学科名称'
  })
  xueke_name: string;

  /**
   * 学科排名分数
   */
  @Column({
    name: 'xueke_rank_score',
    type: 'varchar',
    length: 32,
    comment: '学科排名分数'
  })
  xueke_rank_score: string;

  /**
   * 专业代码
   */
  @Column({
    name: 'major_code',
    type: 'varchar',
    length: 10,
    comment: '专业代码'
  })
  major_code: string;

  /**
   * 排名
   */
  @Column({
    type: 'int',
    comment: '排名'
  })
  rank: number;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({
    name: 'created_at',
    comment: '记录创建时间',
    select: false
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({
    name: 'updated_at',
    comment: '记录最后更新时间',
    select: false
  })
  updatedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 关联的学校详情信息
   */
  @ManyToOne(() => SchoolDetail)
  @JoinColumn({ name: 'school_code', referencedColumnName: 'code' })
  schoolDetail: SchoolDetail;

  /**
   * 关联的专业详情信息
   */
  @ManyToOne(() => MajorDetail)
  @JoinColumn({ name: 'major_code', referencedColumnName: 'code' })
  majorDetail: MajorDetail;
}
