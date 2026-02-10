import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { MajorGroup } from './major-group.entity';
import { School } from './school.entity';

/**
 * 用户选择实体类 - 存储用户的志愿选择信息
 */
@Entity('choices')
@Index(['userId']) // 用户ID索引，提高查询性能
@Index(['mgId']) // 专业组ID索引
@Index(['schoolCode']) // 学校代码索引
@Index(['userId', 'province', 'preferredSubjects', 'year']) // 复合索引：用户ID、省份、首选科目、年份
@Index('idx_choices_user_province_subjects_year_mg_major_unique', ['userId', 'province', 'preferredSubjects', 'secondarySubjects', 'year', 'mgIndex', 'majorIndex'], { unique: true }) // 同一用户、同一省份选科年份下同一专业组内专业序号唯一，支持多省份/选科多套志愿
export class Choice {
  /**
   * 选择记录唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '选择记录唯一标识符' })
  id: number;

  /**
   * 用户ID
   */
  @Column({
    type: 'integer',
    name: 'user_id',
    comment: '用户ID',
  })
  userId: number;

  /**
   * 关联的用户信息（多对一关系）
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user: User;

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
   * 专业组索引
   */
  @Column({
    type: 'integer',
    name: 'mg_index',
    nullable: true,
    comment: '专业组索引',
  })
  mgIndex: number | null;

  /**
   * 关联的专业组信息（多对一关系）
   * 通过 mg_id 字段与 MajorGroup 表的 mgId 字段关联
   */
  @ManyToOne(() => MajorGroup, { nullable: true })
  @JoinColumn({
    name: 'mg_id',
    referencedColumnName: 'mgId',
  })
  majorGroup: MajorGroup | null;

  /**
   * 学校代码
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'school_code',
    nullable: true,
    comment: '学校代码',
  })
  schoolCode: string | null;

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
   * 分数
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: '分数',
  })
  score: number | null;

  /**
   * 首选科目
   */
  @Column({
    type: 'varchar',
    length: 32,
    name: 'preferred_subjects',
    nullable: true,
    comment: '首选科目',
  })
  preferredSubjects: string | null;

  /**
   * 次选科目数组
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
   * 排名
   */
  @Column({
    type: 'integer',
    nullable: true,
    comment: '排名',
  })
  rank: number | null;

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
   * 备注
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '备注',
  })
  remark: string | null;

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
   * 专业索引
   */
  @Column({
    type: 'integer',
    name: 'major_index',
    nullable: true,
    comment: '专业索引',
  })
  majorIndex: number | null;

  /**
   * 专业分数数组（JSON格式）
   */
  @Column({
    type: 'jsonb',
    name: 'major_scores',
    nullable: true,
    comment: '专业分数数组（JSON格式）',
  })
  majorScores: any[] | null;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({
    name: 'created_at',
    comment: '记录创建时间',
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({
    name: 'updated_at',
    comment: '记录最后更新时间',
  })
  updatedAt: Date;
}
