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
import { Element } from './element.entity';
import { LearningStepCard } from './learning-step-card.entity';
import { LearningStepPhaseTitle } from './learning-step-phase-title.entity';

/**
 * 第二步：极致效能学习法清单实体
 * 存储 Start Doing 方法、机制、示例、启动键与工具
 */
@Entity('learning_phase_start_doing_items')
@Index(['stepId', 'stepPhaseTitleId', 'sortOrder'])
@Index(['elementId'], { unique: true })
export class LearningPhaseStartDoingItem {
  /** 主键 ID */
  @PrimaryGeneratedColumn({ comment: '主键' })
  id: number;

  /** 关联子维度（elements.id） */
  @Column({ name: 'element_id', type: 'int', comment: '关联子维度 ID' })
  elementId: number;

  /** 关联步骤 ID */
  @Column({ name: 'step_id', type: 'int', comment: '关联步骤 ID' })
  stepId: number;

  /** 关联步骤阶段标题 ID */
  @Column({ name: 'step_phase_title_id', type: 'int', comment: '关联步骤阶段标题 ID' })
  stepPhaseTitleId: number;

  /** 极致效能学习法 */
  @Column({ name: 'start_doing_method', type: 'text', comment: '极致效能学习法' })
  startDoingMethod: string;

  /** 生理机制 */
  @Column({ name: 'physiology_mechanism', type: 'text', comment: '生理机制' })
  physiologyMechanism: string;

  /** 专属实战示例 */
  @Column({ name: 'exam_example', type: 'text', comment: '专属实战示例' })
  examExample: string;

  /** 0 门槛启动键 */
  @Column({ name: 'quick_start_action', type: 'text', comment: '0 门槛启动键' })
  quickStartAction: string;

  /** 最佳武器 */
  @Column({ name: 'best_tool', type: 'text', comment: '最佳武器' })
  bestTool: string;

  /** 排序 */
  @Column({ name: 'sort_order', type: 'int', default: 0, comment: '排序' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Element, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'element_id', referencedColumnName: 'id' })
  element: Element;

  @ManyToOne(() => LearningStepCard, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'step_id', referencedColumnName: 'id' })
  step: LearningStepCard;

  @ManyToOne(() => LearningStepPhaseTitle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'step_phase_title_id', referencedColumnName: 'id' })
  stepPhaseTitle: LearningStepPhaseTitle;
}
