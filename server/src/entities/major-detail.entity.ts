import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Major } from './major.entity';
import { SchoolMajor } from './school-major.entity';
import { MajorElementAnalysis } from './major-analysis.entity';

/**
 * 专业详情实体类 - 存储专业的详细信息
 * 与专业表通过专业代码进行关联
 */
@Entity('major_details')
@Index(['code']) // 为 code 字段创建索引，提高查询性能
export class MajorDetail {
  /**
   * 专业详情唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '专业详情唯一标识符' })
  // @Column({select:false})
  id: number;

  /**
   * 专业代码 (关联专业表的code字段)
   */
  @Column({ 
    type: 'varchar', 
    length: 10, 
    unique: true,
    comment: '专业代码，关联专业表的code字段' 
  })
  code: string;

  /**
   * 学历层次
   */
  @Column({ 
    name: 'education_level',
    type: 'varchar', 
    length: 20,
    nullable: true,
    comment: '学历层次（如：本科、专科、高职本科）' 
  })
  educationLevel: string | null;

  /**
   * 修业年限
   */
  @Column({ 
    name: 'study_period',
    type: 'varchar', 
    length: 20,
    nullable: true,
    comment: '修业年限（如：四年、三年、两年）' 
  })
  studyPeriod: string | null;

  /**
   * 授予学位
   */
  @Column({ 
    name: 'awarded_degree',
    type: 'varchar', 
    length: 50,
    nullable: true,
    comment: '授予学位（如：工学学士、理学学士）' 
  })
  awardedDegree: string | null;

   
  @Column({
    name: 'major_brief',
    type: 'text',
    nullable: true,
    comment: '专业简介'
  })
  majorBrief: string | null;
  
  @Column({
    name: 'major_key',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '专业关键词'
  })
  majorKey: string | null;


  @Column({
    name: 'opportunity_score',
    type: 'decimal', 
    precision: 5,
    scale: 2,
    nullable: true,
    comment: '机遇指数'
  })
  opportunityScore: number | null;

  @Column({
    name: 'academic_development_score',
    type: 'decimal', 
    precision: 5,
    scale: 2,
    nullable: true,
    comment: '学业发展'
  })
  academicDevelopmentScore: number | null;

  @Column({
    name: 'career_development_score',
    type: 'decimal', 
    precision: 5,
    scale: 2,
    nullable: true,
    comment: '职业发展'
  })
  careerDevelopmentScore: number | null;

  @Column({
    name: 'growth_potential_score',
    type: 'decimal', 
    precision: 5,
    scale: 2,
    nullable: true,
    comment: '成长潜力'
  })
  growthPotentialScore: number | null;

  @Column({
    name: 'industry_prospects_score',
    type: 'decimal', 
    precision: 5,
    scale: 2,
    nullable: true,
    comment: '行业前景'
  })
  industryProspectsScore: number | null;

  @Column({
    name: 'academic_development_tag',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '学业发展标签'
  })
  academicDevelopmentTag: string | null;

  @Column({
    name: 'career_development_tag',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '职业发展标签'
  })
  careerDevelopmentTag: string | null;

  @Column({
    name: 'growth_potential_tag',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '成长潜力标签'
  })
  growthPotentialTag: string | null;

  @Column({
    name: 'industry_prospects_tag',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '行业前景标签'
  })
  industryProspectsTag: string | null;

  @Column({
    name: 'study_content',
    type: 'jsonb',
    nullable: true,
    comment: '学习内容（JSON格式）'
  })
  studyContent: any | null;

  @Column({
    name: 'senior_talk',
    type: 'text',
    nullable: true,
    comment: '学长学姐说'
  })
  seniorTalk: string | null;

  @Column({
    name: 'academic_development',
    type: 'jsonb',
    nullable: true,
    comment: '学业发展（JSON格式）'
  })
  academicDevelopment: any | null;
  @Column({
    name: 'career_development',
    type: 'jsonb',
    nullable: true,
    comment: '职业发展（JSON格式）'
  })
  careerDevelopment: any | null;
  @Column({
    name: 'industry_prospects',
    type: 'jsonb',
    nullable: true,
    comment: '行业前景（JSON格式）'
  })
  industryProspects: any | null;


  @Column({
    name: 'growth_potential',
    type: 'jsonb',
    nullable: true,
    comment: '成长潜力（JSON格式）'
  })
  growthPotential: any | null;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({ 
    name: 'created_at',
    comment: '记录创建时间' ,
    select:false
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({ 
    name: 'updated_at',
    comment: '记录最后更新时间' ,
    select:false
  })
  updatedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 关联的专业信息（一对一关系）
   * 每个专业详情只对应一个专业
   */
  @OneToOne(() => Major, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'code', referencedColumnName: 'code' })
  major: Major;

  /**
   * 关联的学校专业信息列表（一个专业详情对应多个学校专业记录）
   * 通过专业代码(code)字段与 SchoolMajor 表关联
   */
  @OneToMany(() => SchoolMajor, (schoolMajor) => schoolMajor.majorDetail)
  schoolMajors: SchoolMajor[];

  /**
   * 关联的专业分析记录列表（一个专业详情对应多个分析记录）
   */
  @OneToMany(() => MajorElementAnalysis, (analysis) => analysis.majorDetail)
  majorElementAnalyses: MajorElementAnalysis[]; 
 
}
