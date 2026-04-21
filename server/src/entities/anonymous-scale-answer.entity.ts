import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Scale } from './scale.entity';
import { AnonymousUser } from './anonymous-user.entity';

/**
 * 匿名量表答案实体
 * 与 scale_answers 字段结构一致；通过 anonymous_users.id 标识答题者，不关联登录用户
 */
@Entity('anonymous_scale_answers')
@Index(['anonymousUserId', 'scaleId']) // 复合索引：按匿名用户 + 量表查询
@Unique(['anonymousUserId', 'scaleId']) // 同一匿名用户同一量表仅一条答案
export class AnonymousScaleAnswer {
  @PrimaryGeneratedColumn({ comment: '主键ID' })
  id: number;

  @Column({ name: 'scale_id', comment: '量表ID' })
  scaleId: number;

  @Index()
  @Column({ name: 'anonymous_user_id', comment: '匿名用户ID（anonymous_users.id）' })
  anonymousUserId: number;

  @Column({ name: 'score', comment: '得分' })
  score: number;

  @CreateDateColumn({
    name: 'submitted_at',
    select: false,
    comment: '提交时间',
  })
  submittedAt: Date;

  @ManyToOne(() => Scale)
  @JoinColumn({ name: 'scale_id' })
  scale: Scale;

  @ManyToOne(() => AnonymousUser)
  @JoinColumn({ name: 'anonymous_user_id' })
  anonymousUser: AnonymousUser;
}
