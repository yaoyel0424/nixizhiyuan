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
import { Major } from './major.entity';

/**
 * 专业收藏实体类
 * 用于存储用户收藏的专业信息
 */
@Entity('major_favorites')
@Index('idx_major_favorites_user_major', ['userId', 'majorCode'], { unique: true })
@Index('idx_major_favorites_user_id', ['userId'])
@Index('idx_major_favorites_major_code', ['majorCode'])
export class MajorFavorite {
  /**
   * 主键ID，自增长
   */
  @PrimaryGeneratedColumn({ comment: '收藏记录唯一标识符' })
  id: number;

  /**
   * 关联用户ID
   */
  @Column({ name: 'user_id', comment: '用户ID' })
  userId: number;

  /**
   * 关联专业代码
   */
  @Column({ name: 'major_code', length: 10, comment: '专业代码' })
  majorCode: string;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({ name: 'created_at', comment: '收藏时间' })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({ name: 'updated_at', comment: '最后更新时间' })
  updatedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 关联的用户信息（多对一关系）
   * 一个用户可以有多个收藏记录
   */
  @ManyToOne(() => User, (user) => user.majorFavorites, {
    onDelete: 'CASCADE', // 级联删除：用户删除时，其收藏记录也删除
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 关联的专业信息（多对一关系）
   * 一个专业可以被多个用户收藏
   */
  @ManyToOne(() => Major, (major) => major.favorites, {
    onDelete: 'CASCADE', // 级联删除：专业删除时，相关收藏记录也删除
  })
  @JoinColumn({ name: 'major_code', referencedColumnName: 'code' })
  major: Major;
}

