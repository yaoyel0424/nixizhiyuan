import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 学习步骤实体
 * 对应学习流程中的第 1～N 步（如第一步、第二步、第三步、第四步）
 */
@Entity('learning_step_cards')
@Index(['type', 'step', 'subStep'])
export class LearningStepCard {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  /** 学科类型，如 math */
  @Column({ name: 'type', type: 'varchar', length: 50, comment: '学科类型' })
  type: string;

  /** 步骤文案，如 第一步 */
  @Column({ name: 'step', type: 'varchar', length: 50, comment: '步骤文案' })
  step: string;

  /** 步骤内子序号 */
  @Column({ name: 'sub_step', type: 'int', default: 1, comment: '步骤内子序号' })
  subStep: number;

  /** 步骤标题 */
  @Column({ name: 'title', type: 'varchar', length: 255, comment: '步骤标题' })
  title: string;

  /** 主要内容 */
  @Column({ name: 'content', type: 'text', nullable: true, comment: '主要内容' })
  content: string | null;

  /** 底部标题 */
  @Column({ name: 'bottom_title', type: 'varchar', length: 255, nullable: true, comment: '底部标题' })
  bottomTitle: string | null;

  /** 底部补充内容 */
  @Column({ name: 'bottom', type: 'text', nullable: true, comment: '底部补充内容' })
  bottom: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
