import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * 省控线实体类
 * 用于存储各省份各批次的控制分数线信息
 */
@Entity('provincial_control_lines')
@Index('idx_provincial_control_line_province_year_type_batch', ['province', 'year', 'typeName', 'batchName'])
export class ProvincialControlLine {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 类型
   */
  @Column({ name: 'type', type: 'varchar', length: 50, nullable: true, comment: '类型' })
  type: string;

  /**
   * 类型名称
   */
  @Column({ name: 'type_name', type: 'varchar', length: 100, nullable: true, comment: '类型名称' })
  typeName: string;

  /**
   * 批次名称
   */
  @Column({ name: 'batch_name', type: 'varchar', length: 100, nullable: true, comment: '批次名称' })
  batchName: string;

  /**
   * 批次
   */
  @Column({ name: 'batch', type: 'varchar', length: 50, nullable: true, comment: '批次' })
  batch: string;

  /**
   * 分数线
   */
  @Column({ name: 'score', type: 'integer', nullable: true, comment: '分数线' })
  score: number;

  /**
   * 专业分数线
   */
  @Column({ name: 'major_score', type: 'decimal', precision: 6, scale: 2, nullable: true, comment: '专业分数线' })
  majorScore: number;

  /**
   * 排名
   */
  @Column({ name: 'rank', type: 'integer', nullable: true, comment: '排名' })
  rank: number;

  /**
   * 年份
   */
  @Column({ name: 'year', type: 'varchar', length: 4, nullable: true, comment: '年份' })
  year: string;

  /**
   * 省份
   */
  @Column({ name: 'province', type: 'varchar', length: 50, nullable: true, comment: '省份' })
  province: string;

  /**
   * 分数段
   */
  @Column({ name: 'score_section', type: 'varchar', length: 100, nullable: true, comment: '分数段' })
  scoreSection: string;

  /**
   * 常规批次
   */
  @Column({ name: 'convention_batch', type: 'boolean', nullable: true, comment: '常规批次' })
  conventionBatch: boolean;

  /**
   * 名称
   */
  @Column({ name: 'name', type: 'varchar', length: 200, nullable: true, comment: '名称' })
  name: string;

  /**
   * 差值
   */
  @Column({ name: 'diff', type: 'varchar', length: 20, nullable: true, comment: '差值' })
  diff: string;
}
