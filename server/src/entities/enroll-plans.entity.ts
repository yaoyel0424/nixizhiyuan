import { Entity, PrimaryGeneratedColumn, Column, Generated, Index, ManyToOne, JoinColumn } from 'typeorm';
import { SchoolDetail } from './school-detail.entity';
import { MajorDetail } from './major-detail.entity';

/**
 * 招生计划实体类
 * 对应数据库表 enroll_plans
 */
@Entity('enroll_plans')
@Index(['majorCode'])
@Index(['schoolCode'])
@Index(['province'])
@Index(['matchPattern'])
@Index(['schoolCode', 'province', 'year', 'subjectType', 'batch', 'majorCode'])
@Index(['majorCode', 'province', 'year', 'subjectType', 'batch'])
export class EnrollPlans {
  @PrimaryGeneratedColumn()
  @Generated('increment')
  id: number;

  @Column({ name: 'school_code', type: 'varchar', length: 10, nullable: false })
  schoolCode: string;

  @Column({ name: 'major_code', type: 'varchar', length: 10, nullable: false })
  majorCode: string;

  @Column({ name: 'school_major_id', type: 'int', nullable: true })
  schoolMajorId: number;

  @Column({ name: 'subject_type', type: 'varchar', length: 10, nullable: true })
  subjectType: string;

  @Column({ name: 'batch', type: 'varchar', length: 32, nullable: true })
  batch: string;

  @Column({ name: 'num', type: 'varchar', length: 16, nullable: true })
  num: string;

  @Column({ name: 'enroll_type', type: 'varchar', length: 32, nullable: false })
  enrollType: string;

  @Column({ name: 'study_period', type: 'varchar', length: 8, nullable: true })
  studyPeriod: string;

  @Column({ name: 'province', type: 'varchar', length: 16, nullable: true })
  province: string;

  @Column({ name: 'tuition', type: 'varchar', length: 16, nullable: true })
  tuition: string;

  @Column({ name: 'remark', type: 'text', nullable: true })
  remark: string;

  @Column({ name: 'info', type: 'text', nullable: true })
  info: string;

  @Column({ name: 'major_preferred_subject', type: 'varchar', length: 16, nullable: true })
  majorPreferredSubject: string;

  @Column({ name: 'major_secondary_subject', type: 'varchar', length: 32, nullable: true })
  majorSecondarySubject: string;

  @Column({ name: 'major_info', type: 'text', nullable: true })
  majorInfo: string;

  @Column({ name: 'major_group', type: 'int', nullable: true })
  majorGroup: number;

  @Column({ name: 'major_group_preferred_subject', type: 'varchar', length: 16, nullable: true })
  majorGroupPreferredSubject: string;

  @Column({ name: 'major_group_secondary_subject', type: 'varchar', length: 32, nullable: true })
  majorGroupSecondarySubject: string;

  @Column({ name: 'major_group_info', type: 'text', nullable: true })
  majorGroupInfo: string;

  @Column({ name: 'major_group_name', type: 'varchar', length: 128, nullable: true })
  majorGroupName: string;

  @Column({ name: 'level1', type: 'varchar', length: 16, nullable: true })
  level1: string;

  @Column({ name: 'level2', type: 'varchar', length: 64, nullable: true })
  level2: string;

  @Column({ name: 'level3', type: 'varchar', length: 64, nullable: true })
  level3: string;

  @Column({ name: 'major_name_detail', type: 'varchar', nullable: true })
  majorNameDetail: string;

  @Column({ name: 'major_name', type: 'varchar', nullable: true })
  majorName: string;

  
  @Column({ name: 'major_category', type: 'varchar', length: 16, nullable: true })
  majorCategory: string;


  @Column({ name: 'year', type: 'int', nullable: true })
  year: number;

  @Column({ name: 'match_pattern', type: 'varchar', length: 64, nullable: true })
  matchPattern: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;


  @ManyToOne(() => SchoolDetail)
  @JoinColumn({ name: 'school_code', referencedColumnName: 'code' })
  schoolDetail: SchoolDetail;

  /**
   * 关联的专业详细信息（多对一关系）
   * 通过 major_code 字段与 MajorDetail 表关联
   */
  @ManyToOne(() => MajorDetail)
  @JoinColumn({ name: 'major_code', referencedColumnName: 'code' })
  majorDetail: MajorDetail;
}