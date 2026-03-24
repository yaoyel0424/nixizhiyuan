import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 各地数学高考历年模块分值/占比参考数据
 * 每行绑定一个 province（省/直辖市）；同一卷种下多省数值相同则多行重复，不使用 province_scope。
 */
@Entity('gaokao_math_module_stat')
@Index(['province', 'sortOrder'])
export class GaokaoMathModuleStat {
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  /** 省份或直辖市名称 */
  @Column({ name: 'province', type: 'varchar', length: 32, comment: '省份/直辖市' })
  province: string;

  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '模块行排序' })
  sortOrder: number;

  @Column({ name: 'module_name', type: 'varchar', length: 128, comment: '模块名称' })
  moduleName: string;

  @Column({ name: 'is_total_row', type: 'boolean', default: false, comment: '是否合计行' })
  isTotalRow: boolean;

  @Column({ name: 'score_range_2023', type: 'varchar', length: 32, nullable: true, comment: '2023 分值区间' })
  scoreRange2023: string | null;

  @Column({ name: 'score_range_2024', type: 'varchar', length: 32, nullable: true, comment: '2024 分值区间' })
  scoreRange2024: string | null;

  @Column({ name: 'score_range_2025', type: 'varchar', length: 32, nullable: true, comment: '2025 分值区间' })
  scoreRange2025: string | null;

  @Column({ name: 'three_year_mean', type: 'int', nullable: true, comment: '三年均值（分）' })
  threeYearMean: number | null;

  @Column({ name: 'proportion_range', type: 'varchar', length: 32, nullable: true, comment: '占比区间' })
  proportionRange: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
