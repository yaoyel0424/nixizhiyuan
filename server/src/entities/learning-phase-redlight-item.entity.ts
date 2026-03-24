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
 * 第一步：红灯行为清单实体
 * 存储双低场景下的红灯行为、生理归因与止损建议
 */
@Entity('learning_phase_redlight_items')
@Index(['stepId', 'stepPhaseTitleId', 'sortOrder'])
@Index(['elementId'], { unique: true })
export class LearningPhaseRedlightItem {
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

  /** 红灯行为 */
  @Column({ name: 'redlight_behavior', type: 'text', comment: '红灯行为' })
  redlightBehavior: string;

  /** 生理归因 */
  @Column({ name: 'physiology_reason', type: 'text', comment: '生理归因' })
  physiologyReason: string;

  /** 觉察即止损 */
  @Column({ name: 'stop_loss_tip', type: 'text', comment: '觉察即止损' })
  stopLossTip: string;

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
