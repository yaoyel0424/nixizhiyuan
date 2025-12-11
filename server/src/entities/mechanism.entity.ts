import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Element } from './element.entity';

/**
 * 机制实体类
 * 用于存储元素背后的科学机制说明（包括神经科学、化学、遗传学等解释）
 */
@Entity('mechanisms')
export class Mechanism {
  /**
   * 机制唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '机制唯一标识符' })
  id: number;

  /**
   * 关联的元素ID
   * 外键关联到 elements 表的 id
   */
  @Column({
    type: 'int',
    name: 'element_id',
    comment: '关联的元素ID',
  })
  elementId: number;

  /**
   * 关联的元素实体
   * 一对一关系：每个元素对应一个机制
   */
  @OneToOne(() => Element, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'element_id' })
  element: Element;

  /**
   * 是否是你的描述
   * 用于描述用户特征的问句
   */
  @Column({
    type: 'text',
    name: 'is_this_you',
    comment: '是否是你的描述（用于描述用户特征的问句）',
  })
  isThisYou: string;

  /**
   * 底层科学原理
   * 描述该机制背后的宏观功能和神经科学原理
   */
  @Column({
    type: 'text',
    name: 'underlying_science',
    comment: '底层科学原理（描述该机制背后的宏观功能和神经科学原理）',
  })
  underlyingScience: string;

  /**
   * 化学描述
   * 描述相关的神经递质、激素等化学物质的作用
   */
  @Column({
    type: 'text',
    name: 'chemical_description',
    comment: '化学描述（描述相关的神经递质、激素等化学物质的作用）',
  })
  chemicalDescription: string;

  /**
   * 遗传倾向描述
   * 描述相关的基因变异和遗传因素
   */
  @Column({
    type: 'text',
    name: 'genetic_predisposition_description',
    comment: '遗传倾向描述（描述相关的基因变异和遗传因素）',
  })
  geneticPredispositionDescription: string;

  /**
   * 经验强化描述
   * 描述环境因素和早期经历如何强化该机制
   */
  @Column({
    type: 'text',
    name: 'experience_reinforcement_description',
    comment: '经验强化描述（描述环境因素和早期经历如何强化该机制）',
  })
  experienceReinforcementDescription: string;

  /**
   * 简要总结
   * 对该机制的简要概括
   */
  @Column({
    type: 'text',
    comment: '简要总结（对该机制的简要概括）',
  })
  brief: string;

  /**
   * 科学脚注
   * 核心机制、网络和化学物质的关键信息
   */
  @Column({
    type: 'text',
    name: 'scientific_footnote',
    comment: '科学脚注（核心机制、网络和化学物质的关键信息）',
  })
  scientificFootnote: string;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({
    comment: '记录创建时间',
    name: 'created_at',
    select: false,
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({
    comment: '记录最后更新时间',
    name: 'updated_at',
    select: false,
  })
  updatedAt: Date;
}

