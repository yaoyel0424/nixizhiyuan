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
import { Province } from './province.entity';

/**
 * 省份收藏实体类
 * 用于存储用户收藏的省份信息
 */
@Entity('province_favorites')
@Index('idx_province_favorites_user_province', ['userId', 'provinceId'], {
  unique: true,
})
@Index('idx_province_favorites_user_id', ['userId'])
@Index('idx_province_favorites_province_id', ['provinceId'])
export class ProvinceFavorite {
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
   * 关联省份ID
   */
  @Column({ name: 'province_id', type: 'int', comment: '省份ID' })
  provinceId: number;

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
  @ManyToOne(() => User, (user) => user.provinceFavorites, {
    onDelete: 'CASCADE', // 级联删除：用户删除时，其收藏记录也删除
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 关联的省份信息（多对一关系）
   * 一个省份可以被多个用户收藏
   */
  @ManyToOne(() => Province, (province) => province.favorites, {
    onDelete: 'CASCADE', // 级联删除：省份删除时，相关收藏记录也删除
  })
  @JoinColumn({ name: 'province_id' })
  province: Province;
}

