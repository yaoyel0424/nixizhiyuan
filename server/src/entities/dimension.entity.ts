import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 维度类型枚举
 */
export enum DimensionType {
  LIKE = 'like', // 喜欢类型
  TALENT = 'talent', // 天赋类型
}

/**
 * 维度实体类
 * 用于存储用户测评的维度信息（喜欢和天赋两个维度）
 */
@Entity('dimensions')
export class Dimension {
  /**
   * 维度唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '维度唯一标识符' })
  id: number;

  /**
   * 维度类型
   * like: 喜欢类型
   * talent: 天赋类型
   */
  @Column({
    type: 'enum',
    enum: DimensionType,
    comment: '维度类型：like=喜欢类型，talent=天赋类型',
  })
  type: DimensionType;

  /**
   * 维度名称
   * 如：看、听、说、记、想、做、运动
   */
  @Column({
    type: 'varchar',
    length: 50,
    comment: '维度名称（如：看、听、说、记、想、做、运动）',
  })
  dimension: string;

  /**
   * 维度解释说明
   * 对该维度的详细解释文本，可为空
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '维度解释说明',
  })
  interpretation: string | null;

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

