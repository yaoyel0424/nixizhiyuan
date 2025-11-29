import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm";
import { User } from "./user.entity";
import { School } from "./school.entity";

/**
 * 备选方案实体类
 * 用于存储用户的备选专业和学校信息
 */
@Entity("alternatives")
export class Alternative {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({ name: 'user_id' })
    userId: number;

    @Column({ name: 'major_code', length: 50 })
    majorCode: string;

    @Column({ name: 'major_name', length: 100 })
    majorName: string;

    @Column({ name: 'school_code', length: 50 })
    schoolCode: string;

    @Column({ name: 'school_name', length: 100 })
    schoolName: string;

    @Column({ name: 'school_feature', length: 100 })
    schoolFeature: string;

    @Column({ name: 'group', type: 'int' })
    group: number;

    @Column({ type: 'jsonb', name: 'history_score' })
    historyScore: object;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    @Column({ nullable: true, name: 'province', type: 'varchar' })
    province?: string;

    @Column({ nullable: true, name: 'score', type: 'int' })
    score?: number;

    @Column({ nullable: true, name: 'preferred_subjects',length: 32 })
    preferredSubjects?: string; 

    @Column({ nullable: true, name: 'secondary_subjects',length: 32 })
    secondarySubjects?: string;

    @Column({ nullable: true, name: 'rank',type: 'int' })
    rank?: number;

    @Column({ nullable: true, name: 'selected', type: 'boolean' })
    selected?: boolean;

    @Column({ nullable: true, name: 'enrollment_rate', type: 'float' })
    enrollmentRate?: number;

    @Column({ nullable: true, name: 'employment_rate', type: 'float' })
    employmentRate?: number;

    @Column({ nullable: true, name: 'major_group_id', type: 'int' })
    majorGroupId?: number;

    @Column({ nullable: true, name: 'major_group_name', type: 'varchar' })
    majorGroupName?: string;

    @Column({ nullable: true, name: 'rank_diff', type: 'int' })
    rankDiff?: number;

    @Column({ nullable: true, name: 'rank_diff_per', type: 'float' })
    rankDiffPer?: number;
    
    @Column({ 
        nullable: true, 
        name: 'position', 
        type: 'int', 
        default: () => "EXTRACT(EPOCH FROM NOW())::INTEGER"
    })
    position?: number;

    // ==================== 关系映射 ====================

    /**
     * 用户关联 (多对一关系)
     * 多个备选方案对应一个用户
     */
    @ManyToOne(() => User, user => user.alternatives)
    @JoinColumn({ name: 'user_id' })
    user: User;

    /**
     * 学校关联 (多对一关系)
     * 多个备选方案对应一个学校
     * 使用学校代码(schoolCode)作为关联字段
     */
    @ManyToOne(() => School, school => school.alternatives)
    @JoinColumn({ name: 'school_code', referencedColumnName: 'code' })
    school: School;

    
}
