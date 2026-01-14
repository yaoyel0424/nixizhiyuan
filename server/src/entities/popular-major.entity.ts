import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { MajorDetail } from './major-detail.entity';
import { PopularMajorAnswer } from './popular-major-answer.entity';

/**
 * 热门专业实体类 - 存储热门专业的详细信息
 * 与专业详情表通过专业代码进行一对一关联
 */
@Entity('popular_majors')
@Index(['code']) // 用于优化 JOIN: INNER JOIN popular_majors pm ON pm.code = md.code
export class PopularMajor {
  /**
   * 热门专业唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '热门专业唯一标识符' })
  id: number;

  /**
   * 专业名称
   */
  @Column({ 
    type: 'varchar', 
    length: 100, 
    comment: '专业名称' 
  })
  name: string;

  /**
   * 教育层次 (如：ben)
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    name: 'level1',
    comment: '教育层次（如：ben）' 
  })
  level1: string;
 
  /**
   * 专业代码 (关联专业详情表的code字段，外键)
   */
  @Column({ 
    type: 'varchar', 
    length: 10, 
    unique: true,
    comment: '专业代码，关联专业详情表的code字段' 
  })
  code: string;

  /**
   * 授予学位 (如：理学学士,工学学士)
   */
  @Column({ 
    type: 'varchar', 
    length: 100, 
    nullable: true,
    comment: '授予学位（如：理学学士,工学学士）' 
  })
  degree: string | null;

  /**
   * 学制年限 (如：四年)
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    name: 'limit_year',
    nullable: true,
    comment: '学制年限（如：四年）' 
  })
  limitYear: string | null;

  /**
   * 平均薪资
   */
  @Column({ 
    type: 'varchar', 
    length: 20, 
    name: 'average_salary',
    nullable: true,
    comment: '平均薪资' 
  })
  averageSalary: string | null;

  /**
   * 五年平均薪资
   */
  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2, 
    default: 0,
    name: 'five_average_salary',
    comment: '五年平均薪资' ,
    select:false
  })
  fiveAverageSalary: number;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({ 
    name: 'created_at',
    comment: '记录创建时间',
    select: false 
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({ 
    name: 'updated_at',
    comment: '记录最后更新时间',
    select: false 
  })
  updatedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 关联的专业详情信息（一对一关系）
   * 每个热门专业只对应一个专业详情
   */
  @OneToOne(() => MajorDetail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'code', referencedColumnName: 'code' })
  majorDetail: MajorDetail;

  /**
   * 关联的问卷答案列表（一对多关系）
   * 每个热门专业可以有多个用户的问卷答案
   */
  @OneToMany(() => PopularMajorAnswer, (popularMajorAnswer) => popularMajorAnswer.popularMajor)
  answers: PopularMajorAnswer[];
}

