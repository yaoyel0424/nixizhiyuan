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
 * 第四步：方法清单实体
 * 存储输入/处理/输出三阶段的方法、机制与示例
 */
@Entity('learning_step4_method_items')
@Index(['stepId', 'stepPhaseTitleId', 'sortOrder'])
@Index(['stepId', 'elementId'], { unique: true })
export class LearningStep4MethodItem {
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

  /** 方法标题 */
  @Column({ name: 'method_title', type: 'varchar', length: 128, comment: '方法标题' })
  methodTitle: string;

  /** 方法内容 */
  @Column({ name: 'method_content', type: 'text', comment: '方法内容' })
  methodContent: string;

  /** 生理机制 */
  @Column({ name: 'physiology_mechanism', type: 'text', comment: '生理机制' })
  physiologyMechanism: string;

  /** 专属实战示例 */
  @Column({ name: 'exam_example', type: 'text', comment: '专属实战示例' })
  examExample: string;

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
