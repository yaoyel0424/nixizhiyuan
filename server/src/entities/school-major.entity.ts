import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { MajorDetail } from './major-detail.entity';
import { School } from './school.entity';
import { MajorHistoryScore } from './major-history-score.entity';

/**
 * 学校专业关联表实体类
 * 用于建立学校与专业的多对多关系
 * 支持通过学校查询专业和通过专业查询开设院校
 */
@Entity('school_majors') 
@Index('idx_school_majors_school_code', ['schoolCode']) // 学校ID索引
@Index('idx_school_majors_major_code', ['majorCode']) // 专业详情ID索引
@Index('idx_school_majors_composite', ['schoolCode', 'majorCode']) // 复合索引
@Index('idx_school_majors_year', ['year']) // 年份索引
export class SchoolMajor {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn({ comment: '学校专业关联唯一标识符' })
  // @Column({select:false})
  id: number;

  /**
   * 学校ID，关联School表的id字段
   */
  @Column({ 
    type: 'varchar',
    length: 50,
    name: 'school_code',
    comment: '学校ID，关联学校表的主键' 
  })
  schoolCode: string;

  /**
   * 专业详情ID，关联MajorDetail表的id字段
   */
  @Column({ 
    type: 'varchar',
    length: 50,
    name: 'major_code',
    comment: '专业详情ID，关联专业详情表的主键', 
  })
  majorCode: string;

  @Column({ 
    type: 'varchar', 
    name: 'major_name',
    length: 128,
    comment: '专业名称' 
  })
  majorName: string;


  /**
   * 是否为国家级特色专业
   */
  @Column({ 
    type: 'boolean',
    default: false,
    name: 'is_national_feature',
    comment: '是否为国家级特色专业' 
  })
  isNationalFeature: boolean;

  /**
   * 是否为省级特色专业
   */
  @Column({ 
    type: 'boolean',
    default: false,
    name: 'is_province_feature',
    comment: '是否为省级特色专业' 
  })
  isProvinceFeature: boolean;

  /**
   * 是否为重点专业
   */
  @Column({ 
    type: 'boolean',
    default: false,
    name: 'is_important',
    comment: '是否为重点专业' 
  })
  isImportant: boolean;

  /**
   * 是否为一流学科
   */
  @Column({ 
    type: 'boolean',
    default: false,
    name: 'is_first_class',
    comment: '是否为一流学科' 
  })
  isFirstClass: boolean;

  /**
   * 学制年限
   */
  @Column({ 
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'study_period',
    comment: '学制年限（如：四年、三年）' 
  })
  studyPeriod: string | null;

  /**
   * 年份
   */
  @Column({ 
    type: 'varchar',
    length: 10,
    nullable: true,
    name: 'year',
    comment: '数据年份' ,
    select:false
  })
  year: number | null;

  /**
   * 专业排名
   */
  @Column({ 
    type: 'varchar',
    length: 10,
    nullable: true,
    name: 'rank',
    comment: '专业在该软科的排名' ,
    select:false
  })
  rank: number | null;

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
   * 关联的专业详情信息 (多对一关系)
   * 多个学校专业记录可以关联同一个专业详情
   */
  @ManyToOne(() => MajorDetail, {
    onDelete: 'CASCADE', // 当专业详情被删除时，级联删除关联记录
    nullable: false,
  })
  @JoinColumn({ 
    name: 'major_code',
    referencedColumnName: 'code'
  })
  majorDetail: MajorDetail;

  /**
   * 关联的学校信息 (多对一关系)
   * 多个学校专业记录可以关联同一个学校
   */
  @ManyToOne(() => School, {
    onDelete: 'CASCADE', // 当学校被删除时，级联删除关联记录
    nullable: false,
  })
  @JoinColumn({ 
    name: 'school_code',
    referencedColumnName: 'code'
  })
  school: School;

  /**
   * 关联的历年分数记录（一对多关系）
   * 一个学校专业可以有多个历年分数记录
   */
  @OneToMany(() => MajorHistoryScore, historyScore => historyScore.schoolMajor)
  historyScores: MajorHistoryScore[];

  // ==================== 辅助方法 ====================

  /**
   * 获取完整的学校专业描述
   */
  getDescription(): string {
    return `${this.school?.name || '未知学校'} - ${this.majorDetail?.major?.name || '未知专业'}`;
  }

  /**
   * 判断是否为有效的关联记录
   */
  isValid(): boolean {
    return !!(this.majorCode && this.schoolCode);
  }

  /**
   * 获取专业特色标签
   */
  getFeatureTags(): string[] {
    const tags: string[] = [];
    
    if (this.isNationalFeature) {
      tags.push('国家级特色');
    }
    
    if (this.isProvinceFeature) {
      tags.push('省级特色');
    }
    
    if (this.isImportant) {
      tags.push('重点专业');
    }
    
    if (this.isFirstClass) {
      tags.push('一流学科');
    }
    
    return tags;
  }

  /**
   * 获取专业重要程度等级
   */
  getImportanceLevel(): string {
    if (this.isNationalFeature || this.isFirstClass) {
      return '国家级';
    }
    
    if (this.isProvinceFeature || this.isImportant) {
      return '省级';
    }
    
    return '普通';
  }

  /**
   * 获取专业完整信息摘要
   */
  getSummary(): string {
    const parts: string[] = [];
    
    parts.push(this.getDescription());
    
    if (this.studyPeriod) {
      parts.push(`学制：${this.studyPeriod}`);
    }
    
    if (this.year) {
      parts.push(`年份：${this.year}`);
    }
    
    if (this.rank) {
      parts.push(`排名：${this.rank}`);
    }
    
    const tags = this.getFeatureTags();
    if (tags.length > 0) {
      parts.push(`特色：${tags.join('、')}`);
    }
    
    return parts.join(' | ');
  }
}
