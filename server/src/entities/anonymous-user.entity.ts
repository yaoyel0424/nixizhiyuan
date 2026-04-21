import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * 匿名用户实体
 * 主键为 serial，用于与 anonymous_scale_answers 等匿名业务表关联（不绑定登录用户）
 */
@Entity('anonymous_users')
export class AnonymousUser {
  @PrimaryGeneratedColumn({ comment: '主键（serial）' })
  id: number;

  @CreateDateColumn({
    name: 'created_at',
    select: false,
    comment: '创建时间',
  })
  createdAt: Date;
}
