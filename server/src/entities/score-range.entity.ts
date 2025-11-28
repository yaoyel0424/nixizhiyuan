import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * 分数范围实体类
 * 用于存储各省份各年份各科目的分数段统计信息
 */
@Entity('score_ranges')
@Index('idx_score_range_composite', ['provinceName', 'year', 'subjectType', 'scoreKey', 'score', 'batchName', 'controlScore'])
export class ScoreRange {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 省份代码
   */
  @Column({ name: 'province_code', type: 'varchar', length: 10, comment: '省份代码' })
  provinceCode: string;

  /**
   * 省份名称
   */
  @Column({ name: 'province_name', type: 'varchar', length: 50, comment: '省份名称' })
  provinceName: string;

  /**
   * 年份
   */
  @Column({ type: 'int', comment: '年份' })
  year: number;

  /**
   * 科目类型
   */
  @Column({ name: 'subject_type', type: 'varchar', length: 20, comment: '科目类型' })
  subjectType: string;

  /**
   * 分数键值
   */
  @Column({ name: 'score_key', type: 'varchar', length: 50, comment: '分数键值' })
  scoreKey: string; 
  
  /**
   * 创建时间
   */
  @CreateDateColumn({ name: 'create_at', comment: '创建时间' })
  createAt: Date;

  /**
   * 分数
   */
  @Column({ type: 'varchar', length: 128, comment: '分数' })
  score: string;

  /**
   * 人数
   */
  @Column({ type: 'int', comment: '人数' })
  num: number;

  /**
   * 总人数
   */
  @Column({ type: 'int', comment: '总人数' })
  total: number;

  /**
   * 排名范围
   */
  @Column({ name: 'rank_range', type: 'varchar', length: 100, comment: '排名范围' })
  rankRange: string;

  /**
   * 批次名称
   */
  @Column({ name: 'batch_name', type: 'varchar', length: 50, comment: '批次名称' })
  batchName: string;

  /**
   * 控制分数线
   */
  @Column({ name: 'control_score', type: 'int', comment: '控制分数线' })
  controlScore: number;

  /**
   * 同位分
   */
  @Column({ name: 'appositive_fraction', type: 'jsonb', comment: '同位分' })
  appositiveFraction: any;
}
