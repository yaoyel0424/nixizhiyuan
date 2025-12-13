import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Quadrant2FeasibilityStudy } from './quadrant-2-feasibility-study.entity';

/**
 * 第二象限材料实体类
 * 用于存储第二象限的测试材料信息
 */
@Entity('quadrant_2_mats')
export class Quadrant2Mat {
  /**
   * 材料唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '材料唯一标识符' })
  id: number;

  /**
   * 关联的可行性研究ID
   * 外键关联到 quadrant_2_feasibility_studies 表的 id
   */
  @Column({
    type: 'int',
    name: 'feasibility_id',
    comment: '关联的可行性研究ID',
  })
  feasibilityId: number;

  /**
   * 关联的可行性研究实体
   * 多对一关系：多个材料可以关联到同一个可行性研究
   */
  @ManyToOne(
    () => Quadrant2FeasibilityStudy,
    (feasibilityStudy) => feasibilityStudy.mats,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'feasibility_id' })
  feasibilityStudy: Quadrant2FeasibilityStudy;

  /**
   * 材料标题
   * 如：测试A（接驳"说"）
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '材料标题',
  })
  title: string;

  /**
   * 行动描述
   * 具体的测试行动步骤
   */
  @Column({
    type: 'text',
    comment: '行动描述（具体的测试行动步骤）',
  })
  action: string;

  /**
   * 觉察说明
   * 对测试结果的觉察和说明
   */
  @Column({
    type: 'text',
    comment: '觉察说明（对测试结果的觉察和说明）',
  })
  awareness: string;

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

