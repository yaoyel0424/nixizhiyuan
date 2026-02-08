import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ProvinceFavorite } from './province-favorite.entity';

/**
 * 省份实体类
 * 存储全国各省、自治区、直辖市的基本信息和特色描述
 */
@Entity('provinces')
export class Province {
  /**
   * 省份代码（主键，使用国家标准的省份代码）
   */
  @PrimaryColumn({ type: 'int', comment: '省份代码' })
  id: number;

  /**
   * 省份名称
   */
  @Column({ type: 'varchar', length: 50, comment: '省份名称' })
  name: string;

  /**
   * 省份类型（如：直辖市、华北地区、华东地区等）
   */
  @Column({ type: 'varchar', length: 50, comment: '省份类型' })
  type: string;

  /**
   * 总体印象
   */
  @Column({
    type: 'text',
    nullable: true,
    name: 'overall_impression',
    comment: '总体印象描述',
  })
  overallImpression: string;

  /**
   * 生活成本
   */
  @Column({
    type: 'text',
    nullable: true,
    name: 'living_cost',
    comment: '生活成本描述',
  })
  livingCost: string;

  /**
   * 适合人群
   */
  @Column({
    type: 'text',
    nullable: true,
    name: 'suitable_person',
    comment: '适合人群描述',
  })
  suitablePerson: string;

  /**
   * 不适合人群
   */
  @Column({
    type: 'text',
    nullable: true,
    name: 'unsuitable_person',
    comment: '不适合人群描述',
  })
  unsuitablePerson: string;

  /**
   * 重点产业
   */
  @Column({
    type: 'text',
    nullable: true,
    name: 'key_industries',
    comment: '重点产业描述',
  })
  keyIndustries: string;

  /**
   * 典型雇主
   */
  @Column({
    type: 'text',
    nullable: true,
    name: 'typical_employers',
    comment: '典型雇主描述',
  })
  typicalEmployers: string;

  /**
   * 年份（如招生年度）
   */
  @Column({
    type: 'varchar',
    length: 10,
    default: '2025',
    comment: '年份',
  })
  year: string;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({
    name: 'created_at',
    comment: '记录创建时间',
    select: false,
  })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({
    name: 'updated_at',
    comment: '记录最后更新时间',
    select: false,
  })
  updatedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 收藏该省份的用户列表（一对多关系）
   * 一个省份可以被多个用户收藏
   */
  @OneToMany(() => ProvinceFavorite, (provinceFavorite) => provinceFavorite.province)
  favorites: ProvinceFavorite[];
}

