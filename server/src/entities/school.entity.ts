import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne, Index, JoinColumn } from "typeorm";
import { SchoolDetail } from "./school-detail.entity";
import { SchoolMajor } from "./school-major.entity";
import { EnrollCharters } from "./enroll-charter.entity";
import { Alternative } from "./alternative.entity";

/**
 * 学校实体类
 * 用于存储学校信息数据
 */
@Entity("schools")
export class School {
    /**
     * 主键ID，自增长
     */
    @PrimaryGeneratedColumn()
    // @Column({select:false})
    id: number;

    /**
     * 学校代码
     */
    @Column({ length: 50, nullable:false, name: 'code' })
    @Index('IDX_SCHOOL_CODE', { unique: true })
    code: string;

    /**
     * 国标代码
     */
    @Column({ length: 50, nullable: true, name: 'gb_code',select:false })
    gbCode: string;

    /**
     * 中文名称
     */
    @Column({ length: 255, nullable: true, name: 'name' })
    name: string;

    /**
     * 性质类型
     */
    @Column({ length: 100, nullable: true, name: 'nature' })
    nature: string;

    /**
     * 教育层次
     */
    @Column({ length: 100, nullable: true, name: 'level' })
    level: string;

    /**
     * 所属部门
     */
    @Column({ length: 255, nullable: true, name: 'belong' })
    belong: string;

    /**
     * 类别
     */
    @Column({ length: 255, nullable: true, name: 'categories' })
    categories: string;

    /**
     * 特色
     */
    @Column({ type: 'text', nullable: true, name: 'features' })
    features: string;

    /**
     * 艺术特色
     */
    @Column({ type: 'text', nullable: true, name: 'art_features' ,select:false})
    artFeatures: string;

    /**
     * 省份代码
     */
    @Column({ length: 10, nullable: true, name: 'province_code',select:false })
    provinceCode: string;

    /**
     * 省份名称
     */
    @Column({ length: 100, nullable: true, name: 'province_name' })
    provinceName: string;

    /**
     * 城市名称
     */
    @Column({ length: 100, nullable: true, name: 'city_name' })
    cityName: string;

    /**
     * 招生邮箱
     */
    @Column({ length: 128, nullable: true, name: 'admissions_email' })
    admissionsEmail: string;

    /**
     * 学校地址
     */
    @Column({ length: 500, nullable: true, name: 'address' })
    address: string;

    /**
     * 邮政编码
     */
    @Column({ length: 10, nullable: true, name: 'postcode' })
    postcode: string;

    /**
     * 招生网站
     */
    @Column({ length: 255, nullable: true, name: 'admissions_site' })
    admissionsSite: string;

    /**
     * 官方网站
     */
    @Column({ length: 128, nullable: true, name: 'official_site' })
    officialSite: string;

    /**
     * 招生电话
     */
    @Column({ length: 128, nullable: true, name: 'admissions_phone' })
    admissionsPhone: string;

    /**
     * 点击量
     */
    @Column({ type: 'integer', default: 0, name: 'hits' ,select:false})
    hits: number;

    /**
     * 综合排名
     */
    @Column({ type: 'integer', nullable: true, name: 'ranking',select:false })
    ranking: number;

    /**
     * 武书连排名
     */
    @Column({ type: 'integer', nullable: true, name: 'ranking_of_wsl',select:false })
    rankingOfWSL: number;

    /**
     * 软科排名
     */
    @Column({ type: 'integer', nullable: true, name: 'ranking_of_rk' })
    rankingOfRK: number;

    /**
     * 校友会排名
     */
    @Column({ type: 'integer', nullable: true, name: 'ranking_of_xyh' })
    rankingOfXYH: number;

    /**
     * QS排名
     */
    @Column({ type: 'integer', nullable: true, name: 'ranking_of_qs',select:false })
    rankingOfQS: number;

    /**
     * US News排名
     */
    @Column({ type: 'integer', nullable: true, name: 'ranking_of_us_news',select:false })
    rankingOfUSNews: number;

    /**
     *  
     */
    @Column({ type: 'integer', nullable: true, name: 'ranking_of_edu',select:false })
    rankingOfEdu: number;

    /**
     * 综合分数
     */
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'com_score',select:false })
    comScore: number;

    /**
     * 难度分数
     */
    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'diff_score' ,select:false})
    diffScore: number;

    /**
     * 创建时间
     */
    @CreateDateColumn({ name: 'created_at',select:false })
    createdAt: Date;

    /**
     * 更新时间
     */
    @UpdateDateColumn({ name: 'updated_at',select:false })
    updatedAt: Date;

    // ==================== 关系映射 ====================

    /**
     * 学校详细信息关联 (一对一关系)
     * 一个学校对应一个详细信息记录
     */
    @OneToOne(() => SchoolDetail, schoolDetail => schoolDetail.school)
    schoolDetail: SchoolDetail;

    /**
     * 该学校开设的专业关联列表 (一对多关系)
     * 一个学校可以开设多个专业
     * 使用学校代码(code)作为关联字段
     */
    @OneToMany('SchoolMajor', 'school', {
        cascade: true, // 级联操作
    })
    @JoinColumn({ name: 'school_code', referencedColumnName: 'code' })
    schoolMajors: SchoolMajor[];

    /**
     * 该学校的招生章程关联列表 (一对多关系)
     * 一个学校可以有多个年份的招生章程
     * 使用学校代码(code)作为关联字段
     */
    @OneToMany(() => EnrollCharters, enrollCharter => enrollCharter.school, {
        cascade: true, // 级联操作
    })
    enrollCharters: EnrollCharters[];

    /**
     * 该学校的备选方案关联列表 (一对多关系)
     * 一个学校可以有多个备选方案
     * 使用学校代码(code)作为关联字段
     */
    @OneToMany(() => Alternative, alternative => alternative.school)
    alternatives: Alternative[];

    // ==================== 辅助方法 ====================

    /**
     * 获取该学校开设的专业数量
     */
    getMajorCount(): number {
        return this.schoolMajors ? this.schoolMajors.length : 0;
    }
}
