import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Check,
  Unique,
  OneToOne,
  Index,
} from 'typeorm';
import { MajorDetail } from './major-detail.entity';
import { MajorFavorite } from './major-favorite.entity';

/**
 * 专业类型枚举
 */
export enum MajorType {
  UNDERGRADUATE = 'undergraduate', // 本科专业
  JUNIOR_COLLEGE = 'junior_college', // 专科专业
  HIGHER_VOCATIONAL = 'higher_vocational', // 高职（本科）专业
}

/**
 * 专业实体类 - 支持三级分类的父子表结构
 * Level 1: 学科门类 (如：哲学、经济学)
 * Level 2: 专业类 (如：哲学类、经济学类)  
 * Level 3: 具体专业 (如：哲学、逻辑学)
 */
@Entity('majors')
@Unique(['code', 'level']) // 确保同一层级下的代码不重复
@Check(`"level" IN (1, 2, 3)`) // 限制层级只能是1、2、3
@Index(['code', 'eduLevel']) // 用于优化 JOIN 和 WHERE 条件：INNER JOIN majors m ON m.code = md.code AND m.edu_level = ?
export class Major {
  /**
   * 专业唯一标识符 (自增长ID)
   */
  @PrimaryGeneratedColumn({ comment: '专业唯一标识符' })
  // @Column({select:false})
  id: number;

  /**
   * 专业名称
   */
  @Column({ type: 'varchar', length: 100, comment: '专业名称' })
  name: string;

  /**
   * 专业代码 (如：01, 0101, 010101)
   */
  @Column({ type: 'varchar', length: 10, unique: true, comment: '专业代码' })
  code: string; 

  /**
   * 教育层次 (默认为本科：ben)
   */
  @Column({ 
    type: 'varchar', 
    length: 10, 
    default: 'ben',
    name: 'edu_level',
    comment: '教育层次（ben:本科）'
  })
  eduLevel: string;

  /**
   * 站点分配代码
   */
  @Column({ 
    type: 'varchar', 
    length: 10, 
    nullable: true,
    name: 'site_allocation_code',
    comment: '站点分配代码'
  })
  siteAllocationCode: string | null;

  /**
   * 层级标识
   * 1: 学科门类
   * 2: 专业类
   * 3: 具体专业
   */
  @Column({ 
    type: 'int',
    comment: '层级：1=学科门类，2=专业类，3=具体专业'
  })
  level: 1 | 2 | 3;

  /**
   * 父级专业ID (自关联外键)
   */
  @Column({ 
    type: 'int', 
    nullable: true,
    name: 'parent_id',
    comment: '父级专业ID，为空表示顶级'
  })
  parentId: number | null;

  /**
   * 记录创建时间
   */
  @CreateDateColumn({ comment: '记录创建时间',name:"created_at", select:false })
  createdAt: Date;

  /**
   * 记录最后更新时间
   */
  @UpdateDateColumn({ comment: '记录最后更新时间',name:"updated_at", select:false })
  updatedAt: Date;

  // ==================== 关系映射 ====================

  /**
   * 父级专业 (多对一关系)
   * 一个专业只能有一个父级专业
   */
  @ManyToOne(() => Major, (major) => major.children, {
    onDelete: 'CASCADE', // 级联删除
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Major | null;

  /**
   * 子级专业列表 (一对多关系)
   * 一个专业可以有多个子级专业
   */
  @OneToMany(() => Major, (major) => major.parent)
  children: Major[];

  /**
   * 开设该专业的学校关联列表 (一对多关系)
   * 一个专业可以被多个学校开设
   */
  @OneToMany('SchoolMajor', 'major', {
    cascade: true, // 级联操作
  })
  schoolMajors: any[];

  /**
   * 专业详情（一对一关系）
   * 每个专业只对应一个专业详情
   */
  @OneToOne(() => MajorDetail, (majorDetail) => majorDetail.major)
  majorDetail: MajorDetail;

  /**
   * 收藏该专业的用户列表（一对多关系）
   * 一个专业可以被多个用户收藏
   */
  @OneToMany(() => MajorFavorite, (majorFavorite) => majorFavorite.major)
  favorites: MajorFavorite[];


  // ==================== 辅助方法 ====================

  /**
   * 获取层级名称
   */
  getLevelName(): string {
    switch (this.level) {
      case 1:
        return '学科门类';
      case 2:
        return '专业类';
      case 3:
        return '具体专业';
      default:
        return '未知层级';
    }
  }

  /**
   * 判断是否为根节点（学科门类）
   */
  isRoot(): boolean {
    return this.level === 1 && !this.parentId;
  }

  /**
   * 判断是否为叶子节点（没有子专业）
   */
  isLeaf(): boolean {
    return !this.children || this.children.length === 0;
  }

  /**
   * 获取完整的专业路径（从根到当前节点）
   * @param separator 分隔符，默认为 ' > '
   */
  getFullPath(separator: string = ' > '): string {
    const path: string[] = [];
    let current: Major | null = this;
    
    while (current) {
      path.unshift(current.name);
      current = current.parent;
    }
    
    return path.join(separator);
  }

  /**
   * 获取完整的代码路径
   * @param separator 分隔符，默认为 ' > '
   */
  getFullCodePath(separator: string = ' > '): string {
    const path: string[] = [];
    let current: Major | null = this;
    
    while (current) {
      path.unshift(current.code);
      current = current.parent;
    }
    
    return path.join(separator);
  }

  /**
   * 获取开设该专业的学校数量
   */
  getSchoolCount(): number {
    return this.schoolMajors ? this.schoolMajors.length : 0;
  }
}
