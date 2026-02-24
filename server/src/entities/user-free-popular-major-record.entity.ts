import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * 用户使用免费权益的热门专业记录
 * 每用户最多 2 次免费，每条记录对应一次使用的专业（major_code）
 */
@Entity('user_free_popular_major_records')
@Index(['user_id', 'major_code'])
export class UserFreePopularMajorRecord {
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  @Column({ name: 'user_id', type: 'int', comment: '用户 id' })
  user_id: number;

  @Column({
    name: 'major_code',
    length: 20,
    comment: '热门专业代码（使用免费额度时对应的专业）',
  })
  major_code: string;

  @CreateDateColumn({ name: 'created_at', comment: '创建时间' })
  created_at: Date;
}
