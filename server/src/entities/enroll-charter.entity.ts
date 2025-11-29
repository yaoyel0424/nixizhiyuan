import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { School } from "./school.entity";

/**
 * 招生章程实体类
 * 用于存储各学校的招生章程信息
 */
@Entity("enroll_charters")
@Index('IDX_ENROLL_CHARTERS_CODE_YEAR_TYPE', ['code', 'year', 'type'])
export class EnrollCharters {
    /**
     * 主键ID，自增长
     */
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * 学校代码，外键关联 School 表的 code 字段
     */
    @Column({ length: 50, nullable: false, name: 'code' })
    @Index('IDX_ENROLL_CHARTERS_CODE')
    code: string;

    /**
     * 招生章程标题
     */
    @Column({ length: 128, nullable: true, name: 'title' })
    title: string;

    /**
     * 招生章程内容
     */
    @Column({ type: 'text', nullable: true, name: 'content' })
    content: string;

    /**
     * 年份
     */
    @Column({ type: 'integer', nullable: true, name: 'year' })
    year: number;

    /**
     * 类型字段，用于区分不同类型的招生章程
     */
    @Column({ length: 16, nullable: true, name: 'type' })
    type: string;

    /**
     * 创建时间
     */
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    /**
     * 更新时间
     */
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // ==================== 关系映射 ====================

    /**
     * 关联的学校信息 (多对一关系)
     * 多个招生章程可以对应同一个学校
     */
    @ManyToOne(() => School, school => school.code, {
        onDelete: 'CASCADE', // 当学校被删除时，相关的招生章程也会被删除
        onUpdate: 'CASCADE'  // 当学校代码更新时，相关的招生章程也会更新
    })
    @JoinColumn({ name: 'code', referencedColumnName: 'code' })
    school: School;

    // ==================== 辅助方法 ====================

    /**
     * 获取招生章程的年份信息
     */
    getYearInfo(): string {
        return this.year ? `${this.year}年招生章程` : '招生章程';
    }

    /**
     * 检查招生章程内容是否为空
     */
    hasContent(): boolean {
        return !!(this.content && this.content.trim().length > 0);
    }
}
