import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Element } from './element.entity';
import { FourQuadrant } from './four-quadrant.entity';
import { QuadrantChallenge } from './quadrant-1-challenge.entity';
import { QuadrantNiche } from './quadrant-1-niche.entity';
import { Quadrant2LifeChallenge } from './quadrant-2-life-challenge.entity';
import { Quadrant2FeasibilityStudy } from './quadrant-2-feasibility-study.entity';
import { Quadrant3Weakness } from './quadrant-3-weakness.entity';
import { Quadrant3Compensation } from './quadrant-3-compensation.entity';
import { Quadrant4Dilemma } from './quadrant-4-dilemma.entity';
import { Quadrant4GrowthPath } from './quadrant-4-growth-path.entity';

/**
 * 肖像实体类
 * 用于存储用户测评的肖像信息（基于喜欢元素、天赋元素和象限的组合）
 */
@Entity('portraits')
export class Portrait {
  /**
   * 肖像唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '肖像唯一标识符' })
  id: number;

  /**
   * 关联的喜欢元素ID
   * 外键关联到 elements 表的 id
   */
  @Column({
    type: 'int',
    name: 'like_id',
    comment: '关联的喜欢元素ID',
  })
  likeId: number;

  /**
   * 关联的喜欢元素实体
   * 多对一关系：多个肖像可以关联到同一个喜欢元素
   */
  @ManyToOne(() => Element, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'like_id' })
  likeElement: Element;

  /**
   * 关联的天赋元素ID
   * 外键关联到 elements 表的 id
   */
  @Column({
    type: 'int',
    name: 'talent_id',
    comment: '关联的天赋元素ID',
  })
  talentId: number;

  /**
   * 关联的天赋元素实体
   * 多对一关系：多个肖像可以关联到同一个天赋元素
   */
  @ManyToOne(() => Element, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'talent_id' })
  talentElement: Element;

  /**
   * 关联的象限ID
   * 外键关联到 four_quadrants 表的 id
   */
  @Column({
    type: 'int',
    name: 'quadrant_id',
    comment: '关联的象限ID',
  })
  quadrantId: number;

  /**
   * 关联的象限实体
   * 多对一关系：多个肖像可以关联到同一个象限
   */
  @ManyToOne(() => FourQuadrant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quadrant_id' })
  quadrant: FourQuadrant;

  /**
   * 肖像名称
   * 如：天生的'博物学家'、充满热情的'自然爱好者'等
   */
  @Column({
    type: 'varchar',
    length: 200,
    comment: '肖像名称',
  })
  name: string;

  /**
   * 肖像状态描述
   * 对该肖像的详细描述
   */
  @Column({
    type: 'text',
    comment: '肖像状态描述',
  })
  status: string;

  /**
   * 第一部分主标题
   * 可为空
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'part_one_main_title',
    nullable: true,
    comment: '第一部分主标题',
  })
  partOneMainTitle: string | null;

  /**
   * 第一部分副标题
   * 可为空
   */
  @Column({
    type: 'varchar',
    length: 200,
    name: 'part_one_sub_title',
    nullable: true,
    comment: '第一部分副标题',
  })
  partOneSubTitle: string | null;

  /**
   * 第一部分描述
   * 第一部分的详细描述
   */
  @Column({
    type: 'text',
    name: 'part_one_description',
    comment: '第一部分描述',
  })
  partOneDescription: string;

  /**
   * 第二部分描述
   * 可为空
   */
  @Column({
    type: 'text',
    name: 'part_two_description',
    nullable: true,
    comment: '第二部分描述',
  })
  partTwoDescription: string | null;

  /**
   * 第一象限挑战列表
   * 一对多关系：一个肖像可以有多个第一象限挑战
   */
  @OneToMany(() => QuadrantChallenge, (challenge) => challenge.portrait)
  quadrant1Challenges: QuadrantChallenge[];

  /**
   * 第一象限生态位列表
   * 一对多关系：一个肖像可以有多个第一象限生态位
   */
  @OneToMany(() => QuadrantNiche, (niche) => niche.portrait)
  quadrant1Niches: QuadrantNiche[];

  /**
   * 第二象限生活挑战列表
   * 一对多关系：一个肖像可以有多个第二象限生活挑战
   */
  @OneToMany(() => Quadrant2LifeChallenge, (challenge) => challenge.portrait)
  quadrant2LifeChallenges: Quadrant2LifeChallenge[];

  /**
   * 第二象限可行性研究列表
   * 一对多关系：一个肖像可以有多个第二象限可行性研究
   */
  @OneToMany(() => Quadrant2FeasibilityStudy, (study) => study.portrait)
  quadrant2FeasibilityStudies: Quadrant2FeasibilityStudy[];

  /**
   * 第三象限弱点列表
   * 一对多关系：一个肖像可以有多个第三象限弱点
   */
  @OneToMany(() => Quadrant3Weakness, (weakness) => weakness.portrait)
  quadrant3Weaknesses: Quadrant3Weakness[];

  /**
   * 第三象限补偿列表
   * 一对多关系：一个肖像可以有多个第三象限补偿
   */
  @OneToMany(() => Quadrant3Compensation, (compensation) => compensation.portrait)
  quadrant3Compensations: Quadrant3Compensation[];

  /**
   * 第四象限困境列表
   * 一对多关系：一个肖像可以有多个第四象限困境
   */
  @OneToMany(() => Quadrant4Dilemma, (dilemma) => dilemma.portrait)
  quadrant4Dilemmas: Quadrant4Dilemma[];

  /**
   * 第四象限成长路径列表
   * 一对多关系：一个肖像可以有多个第四象限成长路径
   */
  @OneToMany(() => Quadrant4GrowthPath, (growthPath) => growthPath.portrait)
  quadrant4GrowthPaths: Quadrant4GrowthPath[];

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

