import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { EnrollmentPlan } from './enrollment-plan.entity';

/**
 * 专业组实体类 - 存储学校专业组信息
 */
@Entity('major_groups')
@Index(['schoolCode', 'province', 'year','subjectSelectionMode','batch']) // 复合索引，提高查询性能
@Index(['mgId','mgName']) // 专业组ID索引
export class MajorGroup {
  /**
   * 专业组唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '专业组唯一标识符' })
  id: number;

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
   * 专业组ID
   */
  @Column({
    type: 'integer',
    name: 'mg_id',
    nullable: true,
    comment: '专业组ID',
  })
  mgId: number | null;

  /**
   * 专业组名称
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'mg_name',
    nullable: true,
    comment: '专业组名称',
  })
  mgName: string | null;

  /**
   * 专业组信息
   */
  @Column({
    type: 'varchar',
    length: 64,
    name: 'mg_info',
    nullable: true,
    comment: '专业组信息',
  })
  mgInfo: string | null;

  /**
   * 首选科目（物理/历史/不限）
   */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'primary_subject',
    nullable: true,
    comment: '首选科目（物理/历史/不限）',
  })
  primarySubject: string | null;

  /**
   * 次选科目数组（化学、生物、地理、思想政治等）
   * 空数组表示再选不限
   */
  @Index('idx_major_groups_secondary_subjects_gin', { synchronize: false })
  @Column({
    type: 'varchar',
    array: true,
    name: 'secondary_subjects',
    nullable: true,
    comment: '次选科目数组',
  })
  secondarySubjects: string[] | null;

  /**
   * 次选科目类型
   * true: 必选（数组中的所有科目都必须选）
   * false: 任选（数组中的科目任选其一，或都不选）
   * null: 不限（空数组）
   */
  @Column({
    type: 'boolean',
    name: 'secondary_subject_type',
    nullable: true,
    comment: '次选科目类型（true=必选，false=任选，null=不限）',
  })
  secondarySubjectType: boolean | null;

  /**
   * 关联的招生计划列表（一对多关系）
   * 一个专业组可以对应多个招生计划
   */
  @OneToMany(() => EnrollmentPlan, (enrollmentPlan) => enrollmentPlan.majorGroup)
  enrollmentPlans: EnrollmentPlan[];

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
}

