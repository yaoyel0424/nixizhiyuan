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
import { LearningStepCard } from './learning-step-card.entity';

/**
 * 学习步骤阶段标题实体
 * 每个步骤包含 Input / Process / Output 阶段标题
 */
@Entity('learning_step_phase_titles')
@Index(['stepId', 'sortOrder'])
export class LearningStepPhaseTitle {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  /** 关联步骤 ID */
  @Column({ name: 'step_id', type: 'int', comment: '关联步骤 ID' })
  stepId: number;

  /** 阶段类型：信息/能量输入(Input) 等 */
  @Column({ name: 'phase_type', type: 'varchar', length: 40, comment: '阶段类型' })
  phaseType: string;

  /** 阶段标题 */
  @Column({ name: 'title', type: 'varchar', length: 255, comment: '阶段标题' })
  title: string;

  /** 同一步内排序 */
  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '同一步内排序' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => LearningStepCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'step_id', referencedColumnName: 'id' })
  step: LearningStepCard;
}
