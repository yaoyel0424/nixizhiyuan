import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from "typeorm";
import { School } from "./school.entity";

/**
 * 标签接口
 */
interface Tag {
    name: string;
    category?: string;
    weight?: number;
}

/**
 * 实验室/项目接口
 */
interface Lab {
    name: string;
    level: string;
    year?: number;
    description?: string;
}

/**
 * 专业信息接口
 */
interface Major {
    name: string;
    ranking?: number;
    features?: string[];
    employmentRate?: number;
}

/**
 * 推荐/槽点接口
 */
interface Review {
    content: string;
    author?: string;
    grade?: string;
    date?: string;
    likes?: number;
}

/**
 * 学校详细信息实体类
 * 用于存储学校的详细介绍、评价等信息
 */
@Entity("school_details")
export class SchoolDetail {
    /**
     * 主键ID，关联到School表的ID
     * 一对一关系，不自增长
     */
    @PrimaryColumn()
    id: number;

    /**
     * 学校代码
     * 用于与School表建立关联
     */
    @Column({ length: 50, nullable: true, name: 'code', unique: true })
    code: string;

    /**
     * 一句话点评
     */
    @Column({ type: 'jsonb', nullable: true, name: 'brief_comment' })
    briefComment: {
        content: string;
        tags: string[];
        rating?: number;
    };

    /**
     * 重点标签信息
     */
    @Column({ type: 'jsonb', nullable: true, name: 'key_tags' })
    keyTags: Tag[];

    /**
     * 学校历史及简介
     */
    @Column({ type: 'jsonb', nullable: true, name: 'history_intro' })
    historyIntro: {
        foundingYear: number;
        history: string;
        introduction: string;
        milestones?: { year: number; event: string }[];
    };

    /**
     * 优势专业
     */
    @Column({ type: 'jsonb', nullable: true, name: 'advantage_majors' })
    advantageMajors: Major[];

    /**
     * 国家级实验室或项目
     */
    @Column({ type: 'jsonb', nullable: true, name: 'national_labs' })
    nationalLabs: Lab[];

    /**
     * 省级实验室或项目
     */
    @Column({ type: 'jsonb', nullable: true, name: 'provincial_labs' })
    provincialLabs: Lab[];

    /**
     * 学长推荐
     */
    @Column({ type: 'jsonb', nullable: true, name: 'senior_recommendations' })
    seniorRecommendations: Review[];

    /**
     * 学校槽点
     */
    @Column({ type: 'jsonb', nullable: true, name: 'disadvantages' })
    disadvantages: Review[];

    /**
     * 数据来源
     */
    @Column({ type: 'jsonb', nullable: true, name: 'data_source' })
    dataSource: {
        name: string;
        url?: string;
        updateTime: string;
        reliability?: number;
    };

    /**
     * 升学率
     * 表示学校学生继续深造的比例，以百分比形式存储
     */
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'enrollment_rate' })
    enrollmentRate: number;

    /**
     * 就业率
     * 表示学校学生就业的比例，以百分比形式存储
     */
    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'employment_rate' })
    employmentRate: number;

    /**
     * 最后修改人
     */
    @Column({ type: 'jsonb', nullable: true, name: 'last_modified_by' ,select:false})
    lastModifiedBy: {
        id: string;
        name: string;
        role: string;
        modifyTime: string;
    };

    /**
     * 创建时间
     */
    @CreateDateColumn({ name: 'created_at',select:false })
    createdAt: Date;

    /**
     * 更新时间
     */
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;

    // ==================== 关系映射 ====================

    /**
     * 关联的学校信息 (一对一关系)
     * 使用code和id字段建立关联
     */
    @OneToOne(() => School, school => school.schoolDetail)
    @JoinColumn([
        { name: 'code', referencedColumnName: 'code' }   
    ])
    school: School;
}
