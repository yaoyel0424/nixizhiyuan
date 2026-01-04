import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MajorGroup } from './major-group.entity';

/**
 * 专业分数实体类 - 存储专业录取分数信息
 */
@Entity('major_scores')
@Index(['schoolCode', 'province', 'year','enrollmentType']) // 复合索引，提高查询性能
@Index(['majorGroupId']) // 专业组ID索引
export class MajorScore {
  /**
   * 专业分数唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '专业分数唯一标识符' })
  id: number;

  /**
   * 专业组ID
   */
  @Column({
    type: 'integer',
    name: 'major_group_id',
    nullable: true,
    comment: '专业组ID',
  })
  majorGroupId: number | null;

  /**
   * 学校代码
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'school_code',
    comment: '学校代码',
  })
  schoolCode: string;

  /**
   * 省份
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '省份',
  })
  province: string | null;

  /**
   * 年份
   */
  @Column({
    type: 'varchar',
    length: 10,
    nullable: true,
    comment: '年份',
  })
  year: string | null;

  /**
   * 选科模式
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'subject_selection_mode',
    nullable: true,
    comment: '选科模式',
  })
  subjectSelectionMode: string | null;

  /**
   * 批次
   */
  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    comment: '批次',
  })
  batch: string | null;

  /**
   * 差值
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '差值',
  })
  diff: number | null;

  /**
   * 平均分
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '平均分',
  })
  average: number | null;

  /**
   * 最低分
   */
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    name: 'min_score',
    nullable: true,
    comment: '最低分',
  })
  minScore: number | null;

  /**
   * 最低排名
   */
  @Column({
    type: 'integer',
    name: 'min_rank',
    nullable: true,
    comment: '最低排名',
  })
  minRank: number | null;

  /**
   * 录取人数
   */
  @Column({
    type: 'integer',
    name: 'admit_count',
    nullable: true,
    comment: '录取人数',
  })
  admitCount: number | null;

  /**
   * 招生类型
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'enrollment_type',
    nullable: true,
    comment: '招生类型',
  })
  enrollmentType: string | null;

  /**
   * 招生专业
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'enrollment_major',
    nullable: true,
    comment: '招生专业',
  })
  enrollmentMajor: string | null;

  /**
   * 三级专业ID数组
   */
  @Column({
    type: 'integer',
    array: true,
    name: 'level3_major_id',
    nullable: true,
    comment: '三级专业ID数组',
  })
  level3MajorId: number[] | null;

  /**
   * 二级专业ID数组
   */
  @Column({
    type: 'integer',
    array: true,
    name: 'level2_major_ids',
    nullable: true,
    comment: '二级专业ID数组',
  })
  level2MajorIds: number[] | null;

  /**
   * 子二级专业ID数组
   */
  @Column({
    type: 'integer',
    array: true,
    name: 'sub_level2_major_ids',
    nullable: true,
    comment: '子二级专业ID数组',
  })
  subLevel2MajorIds: number[] | null;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({
    name: 'created_at',
    comment: '记录创建时间',
    select: false,
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({
    name: 'updated_at',
    comment: '记录最后更新时间',
    select: false,
  })
  updatedAt: Date;

  /**
   * 关联的专业组信息（多对一关系）
   * 通过 major_group_id 字段与 MajorGroup 表的 mg_id 字段关联
   */
  @ManyToOne(() => MajorGroup, { nullable: true })
  @JoinColumn({
    name: 'major_group_id',
    referencedColumnName: 'mgId',
  })
  majorGroup: MajorGroup | null;
}

