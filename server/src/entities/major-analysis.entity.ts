import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    Index,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { MajorDetail } from './major-detail.entity';
  import { Element } from './element.entity';
  
  /**
   * 专业与喜欢与天赋分析表实体类
   * 用于存储专业与元素（喜欢/天赋）之间的分析与匹配信息
   */
  @Entity('major_element_analysis')
  @Index(['majorDetailId', 'elementId']) // 联合索引提升查询效率
  export class MajorElementAnalysis {
    /**
     * 主键，自增长ID
     */
    @PrimaryGeneratedColumn({ comment: '主键，自增长ID' })
    id: number;
  
    /**
     * 关联的专业详情ID
     */
    @Column({ name: 'major_id', comment: '关联的专业详情ID' })
    majorDetailId: number;
  
    /**
     * 关联的专业详情实体
     */
    @ManyToOne(() => MajorDetail, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'major_id', referencedColumnName: 'id' })
    majorDetail: MajorDetail;
  
    /**
     * 类型（lexue/shanxue）
     */
    @Column({ type: 'varchar', length: 20, comment: '类型（lexue/shanxue）' })
    type: 'lexue' | 'shanxue';
  
    @Column({ name: 'weight', comment: '权重', default: 1, type: 'int'})
    weight: number;
    /**
     * 关联的元素ID
     */
    @Column({ name: 'element_id', comment: '关联的元素ID' })
    elementId: number;
  
    /**
     * 关联的元素实体
     */
    @ManyToOne(() => Element, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'element_id', referencedColumnName: 'id' })
    element: Element;
  
    /**
     * 简述
     */
    @Column({ type: 'varchar', length: 255, nullable: true, comment: '简述' })
    summary: string;
  
    /**
     * 匹配原因
     */
    @Column({ type: 'text', name: 'match_reason', nullable: true, comment: '匹配原因' })
    matchReason: string;
  
    /**
     * 理论依据
     */
    @Column({ type: 'text', nullable: true, comment: '理论依据' , name: 'theory_basis'})
    theoryBasis: string;
  
    /**
     * 原始输入
     */
    @Column({ type: 'text', nullable: true, comment: '原始输入' , name: 'raw_input'})
    rawInput: string;

    /**
     * 潜力转换原因
     */
    @Column({ type: 'text', nullable: true, comment: '潜在转换原因' , name: 'potential_conversion_reason'})
    potentialConversionReason?: string;

    /**
     * 潜力转换值
     */
    @Column({ type: 'varchar', length: 8, nullable: true, comment: '潜力转换值' , name: 'potential_conversion_value'})
    potentialConversionValue?: string;

    /**
     * 潜力转换值
  
    /**
     * 创建时间，自动生成
     */
    @CreateDateColumn({ name: 'created_at', type: 'timestamp', comment: '创建时间' ,select: false})
    createdAt: Date;
  
    /**
     * 更新时间，自动更新
     */
    @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', comment: '更新时间' ,select: false})
    updatedAt: Date;
  
    /**
     * 最后更新用户
     */
    @Column({ name: 'last_update_user', type: 'varchar', length: 50, nullable: true, comment: '最后更新的用户' })
    lastUpdateUser: string;
  } 