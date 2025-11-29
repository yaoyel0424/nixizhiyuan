import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from 'typeorm';
import { SchoolMajor } from './school-major.entity';

/**
 * 专业历年分数实体类
 * 记录各专业在不同年份的录取分数等信息
 */
@Entity('major_history_scores')
@Index('idx_major_history_scores_school_major', ['schoolMajorId'])
@Index('idx_major_history_scores_composite', ['schoolMajorId', 'province', 'subjectType', 'batch', 'subjectSelection'])
@Index('idx_major_history_scores_province_subject_batch', ['province', 'subjectType', 'batch', 'subjectSelection'])
export class MajorHistoryScore {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn({ comment: '历年分数记录唯一标识符' })
  id: number;

  /**
   * 关联的学校专业ID
   */
  @Column({
    name: 'school_major_id',
    type: 'int',
    comment: '关联的学校专业ID'
  })
  schoolMajorId: number;

  /**
   * 省份
   */
  @Column({
    type: 'varchar',
    length: 50,
    comment: '省份'
  })
  province: string;

  /**
   * 科类（文科/理科）
   */
  @Column({
    name: 'subject_type',
    type: 'varchar',
    length: 20,
    comment: '科类（文科/理科）'
  })
  subjectType: string;

  /**
   * 批次
   */
  @Column({
    type: 'varchar',
    length: 50,
    comment: '录取批次'
  })
  batch: string;

  /**
   * 备注信息
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: '备注信息'
  })
  remark: string | null;

  /**
   * 计划专业名称
   */
  @Column({
    name: 'plan_major_name',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '计划专业名称'
  })
  planMajorName: string | null;

  /**
   * 计划招生人数
   */
  @Column({
    name: 'plan_num',
    type: 'int',
    nullable: true,
    comment: '计划招生人数'
  })
  planNum: number | null;

  /**
   * 选科要求
   */
  @Column({
    name: 'subject_selection',
    type: 'varchar',
    length: 100,
    nullable: true,
    comment: '选科要求'
  })
  subjectSelection: string | null;

  /**
   * 学制
   */
  @Column({
    name: 'study_period',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: '学制'
  })
  studyPeriod: string | null;

  /**
   * 学费
   */
  @Column({
    type: 'varchar',
    precision: 10,
    scale: 2,
    nullable: true,
    comment: '学费'
  })
  tuition: string | null;

  /**
   * 历年分数数据（JSON格式）
   */
  @Column({
    name: 'history_score',
    type: 'jsonb',
    nullable: true,
    comment: '历年分数数据'
  })
  historyScore: object | null;

  /**
   * 年份
   */
  @Column({
    type: 'int',
    comment: '数据年份'
  })
  year: number;

  // @Column({
  //   type: 'varchar',
  //   length: 50,
  //   comment: '教育类型'
  // })
  // eduType: string;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({
    name: 'created_at',
    comment: '记录创建时间'
  })
  createdAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 关联的学校专业信息 (多对一关系)
   */
  @ManyToOne(() => SchoolMajor, {
    onDelete: 'CASCADE', // 当学校专业被删除时，级联删除分数记录
    nullable: false,
  })
  @JoinColumn({
    name: 'school_major_id'
  })
  schoolMajor: SchoolMajor;

  // ==================== 辅助方法 ====================

  /**
   * 获取最新一年的分数信息
   */
  getLatestScore(): any {
    if (!this.historyScore) return null;
    const scores = this.historyScore as Record<string, any>;
    const years = Object.keys(scores).sort((a, b) => Number(b) - Number(a));
    return years.length > 0 ? scores[years[0]] : null;
  }

  /**
   * 获取完整的专业分数描述
   */
  getDescription(): string {
    const parts = [
      `${this.province} ${this.year}年`,
      this.subjectType,
      this.batch
    ];
    
    if (this.planMajorName) {
      parts.push(`专业名称：${this.planMajorName}`);
    }
    
    const latestScore = this.getLatestScore();
    if (latestScore) {
      parts.push(`最低分：${latestScore.minScore || '暂无'}`);
    }
    
    return parts.join(' | ');
  }
}
