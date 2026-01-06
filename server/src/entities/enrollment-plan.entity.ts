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
import { School } from './school.entity';
import { SchoolDetail } from './school-detail.entity';

/**
 * 招生计划实体类 - 存储学校招生计划信息
 */
@Entity('enrollment_plans')
@Index(['schoolCode', 'province', 'subjectSelectionMode', 'batch', 'enrollmentType', 'year']) // 复合索引，提高查询性能
@Index(['majorGroupId']) // 专业组ID索引
export class EnrollmentPlan {
  /**
   * 招生计划唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '招生计划唯一标识符' })
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
   * 关联的专业组信息（多对一关系）
   * 通过 major_group_id 字段与 MajorGroup 表的 mg_id 字段关联
   */
  @ManyToOne(() => MajorGroup, { nullable: true })
  @JoinColumn({
    name: 'major_group_id',
    referencedColumnName: 'mgId',
  })
  majorGroup: MajorGroup | null;

  /**
   * 专业组信息
   */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'major_group_info',
    nullable: true,
    comment: '专业组信息',
  })
  majorGroupInfo: string | null;

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
   * 学制
   */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'study_period',
    nullable: true,
    comment: '学制',
  })
  studyPeriod: string | null;

  /**
   * 招生计划数
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'enrollment_quota',
    nullable: true,
    comment: '招生计划数',
  })
  enrollmentQuota: string | null;

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
   * 备注
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '备注',
  })
  remark: string | null;

  /**
   * 关键词数组
   */
  @Column({
    type: 'varchar',
    length: 200,
    array: true,
    name: 'key_words',
    nullable: true,
    comment: '关键词数组',
  })
  keyWords: string[] | null;

  /**
   * 学费
   */
  @Column({
    type: 'varchar',
    length: 100,
    name: 'tuition_fee',
    nullable: true,
    comment: '学费',
  })
  tuitionFee: string | null;

  /**
   * 招生专业（专业名称）
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'enrollment_major',
    nullable: true,
    comment: '招生专业（专业名称）',
  })
  enrollmentMajor: string | null;

  /**
   * 货币单位
   */
  @Column({
    type: 'varchar',
    length: 10,
    name: 'cur_unit',
    nullable: true,
    comment: '货币单位',
  })
  curUnit: string | null;

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

  // ==================== 关系映射 ====================

  /**
   * 关联的学校信息（多对一关系）
   * 通过 school_code 字段与 School 表的 code 字段关联
   */
  @ManyToOne(() => School, { nullable: true })
  @JoinColumn({
    name: 'school_code',
    referencedColumnName: 'code',
  })
  school: School | null;

  /**
   * 关联的学校详细信息（通过 schoolCode 关联 SchoolDetail 的 code）
   * 注意：这是一个虚拟关系，需要通过查询手动关联
   */
  schoolDetail: SchoolDetail | null;
}

