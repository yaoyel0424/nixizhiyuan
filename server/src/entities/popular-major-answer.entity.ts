import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { PopularMajor } from './popular-major.entity';
import { Scale } from './scale.entity';
import { User } from './user.entity';

/**
 * 热门专业问卷答案实体类
 * 存储用户对热门专业问卷的答案
 */
@Entity('popular_major_answers')
@Index(['userId', 'popularMajorId', 'scaleId'], { unique: true }) // 确保同一用户对同一专业的同一题目只能有一个答案
export class PopularMajorAnswer {
  /**
   * 答案唯一标识符
   */
  @PrimaryGeneratedColumn({ comment: '答案唯一标识符' })
  id: number;

  /**
   * 用户ID
   */
  @Index()
  @Column({ name: 'user_id', comment: '用户ID' })
  userId: number;

  /**
   * 热门专业ID
   */
  @Index()
  @Column({ name: 'popular_major_id', comment: '热门专业ID' })
  popularMajorId: number;

  /**
   * 量表ID（问卷题目ID）
   */
  @Index()
  @Column({ name: 'scale_id', comment: '量表ID（问卷题目ID）' })
  scaleId: number;

  /**
   * 答案分数
   */
  @Column({ name: 'score', type: 'decimal', precision: 5, scale: 2, comment: '答案分数' })
  score: number;

  /**
   * 提交时间
   */
  @CreateDateColumn({
    name: 'submitted_at',
    comment: '提交时间' 
  })
  submittedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 关联的用户信息
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 关联的热门专业信息
   */
  @ManyToOne(() => PopularMajor)
  @JoinColumn({ name: 'popular_major_id' })
  popularMajor: PopularMajor;

  /**
   * 关联的量表信息（问卷题目）
   */
  @ManyToOne(() => Scale)
  @JoinColumn({ name: 'scale_id' })
  scale: Scale;
}

