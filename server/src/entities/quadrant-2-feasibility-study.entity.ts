import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Portrait } from './portrait.entity';
import { Quadrant2Mat } from './quadrant-2-mat.entity';

/**
 * 第二象限可行性研究实体类
 * 用于存储第二象限的可行性研究信息
 */
@Entity('quadrant_2_feasibility_studies')
export class Quadrant2FeasibilityStudy {
  /**
   * 可行性研究唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '可行性研究唯一标识符' })
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
   * 多对一关系：多个可行性研究可以关联到同一个肖像
   */
  @ManyToOne(() => Portrait, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait;

  /**
   * 可行性研究标题
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '可行性研究标题',
  })
  title: string;

  /**
   * 天赋价值
   * 描述如何利用天赋价值
   */
  @Column({
    type: 'text',
    name: 'talent_value',
    comment: '天赋价值（描述如何利用天赋价值）',
  })
  talentValue: string;

  /**
   * 探索参考
   * 相关的职业或角色参考
   */
  @Column({
    type: 'text',
    name: 'exploratory_reference',
    comment: '探索参考（相关的职业或角色参考）',
  })
  exploratoryReference: string;

  /**
   * 场景设置
   * 描述测试场景
   */
  @Column({
    type: 'text',
    name: 'scene_setting',
    comment: '场景设置（描述测试场景）',
  })
  sceneSetting: string;

  /**
   * 关联的材料列表
   * 一对多关系：一个可行性研究可以有多个材料
   */
  @OneToMany(() => Quadrant2Mat, (mat) => mat.feasibilityStudy)
  mats: Quadrant2Mat[];

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

