import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Portrait } from './portrait.entity';

/**
 * 画像反馈实体类
 * 用于存储用户对画像展示内容的反馈（非常符合、比较符合、一般等）
 */
@Entity('portrait_feedbacks')
@Index(['userId', 'createdAt'])
export class PortraitFeedback {
  /**
   * 反馈唯一标识符
   */
  @PrimaryGeneratedColumn({ comment: '反馈唯一标识符' })
  id: number;

  /**
   * 用户ID
   * 外键关联到 users 表的 id
   */
  @Column({
    type: 'int',
    name: 'user_id',
    comment: '用户ID',
  })
  userId: number;

  /**
   * 关联用户实体
   */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /**
   * 画像ID（可选）
   * 外键关联到 portraits 表的 id，若为整体反馈可为空
   */
  @Column({
    type: 'int',
    name: 'portrait_id',
    comment: '画像ID（可选）',
    nullable: true,
  })
  portraitId: number | null;

  /**
   * 关联画像实体
   */
  @ManyToOne(() => Portrait, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'portrait_id' })
  portrait: Portrait | null;

  /**
   * 反馈选项
   * 如：非常符合、比较符合、一般、不太符合、完全不符合、符合我以前的状态
   */
  @Column({
    type: 'varchar',
    length: 64,
    comment: '反馈选项',
  })
  option: string;

  /**
   * 创建时间
   */
  @CreateDateColumn({
    name: 'created_at',
    comment: '创建时间',
  })
  createdAt: Date;
}
