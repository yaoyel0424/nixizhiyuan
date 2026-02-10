import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 省份批次实体类
 * 用于存储各省份、批次的志愿填报时段及分数线等信息
 */
@Entity('province_batches')
@Index(['province', 'batch', 'year'])
export class ProvinceBatch {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  /**
   * 省份
   */
  @Column({ type: 'varchar', length: 50, comment: '省份' })
  province: string;

  /**
   * 批次
   */
  @Column({ type: 'varchar', length: 100, comment: '批次' })
  batch: string;

  /**
   * 年份
   */
  @Column({ type: 'varchar', length: 10, comment: '年份' })
  year: string;

  /**
   * 类型：ben-本科，zhuan-专科
   */
  @Column({ type: 'varchar', length: 10, comment: '类型：ben-本科，zhuan-专科' })
  type: 'ben' | 'zhuan';

  /**
   * 最低分/分数线
   */
  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    name: 'min_score',
    nullable: true,
    comment: '最低分/分数线',
  })
  minScore: number | null;

  /**
   * 志愿数量
   */
  @Column({
    type: 'int',
    name: 'volunteer_count',
    nullable: true,
    comment: '志愿数量',
  })
  volunteerCount: number | null;

  /**
   * 开始时间
   */
  @Column({
    type: 'timestamp',
    name: 'start_at',
    nullable: true,
    comment: '开始时间',
  })
  startAt: Date | null;

  /**
   * 结束时间
   */
  @Column({
    type: 'timestamp',
    name: 'end_at',
    nullable: true,
    comment: '结束时间',
  })
  endAt: Date | null;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({ name: 'created_at', comment: '记录创建时间', select: false })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({ name: 'updated_at', comment: '记录最后更新时间', select: false })
  updatedAt: Date;
}
