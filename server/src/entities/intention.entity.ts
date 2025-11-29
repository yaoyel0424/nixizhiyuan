import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index
} from "typeorm";
import { User } from './user.entity';
import { MajorDetail } from './major-detail.entity';

/**
 * 专业意向表 - 存储用户收藏的专业意向信息
 */
@Entity("intentions")
@Index("idx_intentions_user_major", ["userId", "majorCode"], { unique: true })
@Index("idx_intentions_user_id", ["userId"])
@Index("idx_intentions_major_code", ["majorCode"])
export class Intention {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * 关联用户ID
   */
  @Column({ name: 'user_id' })
  userId: number;

  /**
   * 关联专业代码
   */
  @Column({ name: 'major_code', length: 10 })
  majorCode: string;

  /**
   * 省份名称
   */
  @Column({ name: 'province', length: 50, nullable: true })
  province?: string;

  /**
   * 分数
   */
  @Column({ name: 'score', type: 'int', nullable: true })
  score?: number;

  /**
   * 位次
   */
  @Column({ name: 'rank', type: 'int', nullable: true })
  rank?: number;

  /**
   * 首选科目
   */
  @Column({ name: 'preferred_subjects', length: 32, nullable: true })
  preferredSubjects?: string;

  /**
   * 次选科目
   */
  @Column({ name: 'secondary_subjects', length: 32, nullable: true })
  secondarySubjects?: string;

  /**
   * 分组0
   */
  @Column({ name: 'group_0',type: 'int',  nullable: true })
  group0?: number;

  /**
   * 分组1
   */
  @Column({ name: 'group_1',type: 'int',  nullable: true })
  group1?: number;

  /**
   * 分组2
   */
  @Column({ name: 'group_2',type: 'int',  nullable: true })
  group2?: number;

  /**
   * 分组3
   */
  @Column({ name: 'group_3',type: 'int',  nullable: true })
  group3?: number;

  /**
   * 创建时间
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * 更新时间
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 关联的用户信息（多对一关系）
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 关联的专业详情（多对一关系）
   */
  @ManyToOne(() => MajorDetail, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'major_code', referencedColumnName: 'code' })
  majorDetail: MajorDetail;
}
