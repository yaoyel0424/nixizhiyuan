import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Generated } from "typeorm";
import { Order } from './order.entity';
import { ScaleAnswer } from './scale-answer.entity';
import { Intention } from './intention.entity';
import { Alternative } from './alternative.entity';
import { MajorFavorite } from './major-favorite.entity';
import { ProvinceFavorite } from './province-favorite.entity';
import { PopularMajorAnswer } from './popular-major-answer.entity';

@Entity("users")
export class User {
    @PrimaryGeneratedColumn()
    @Generated('increment')
    id: number;

    @Column({ length: 100, unique: true, name: 'openid' })
    openid: string; 

    @Column({ length: 100, nullable: true, name: 'nickname' })
    nickname: string;

    @Column({ nullable: true, name: 'avatar_url' })
    avatarUrl: string;

    @Column({ length: 100, unique: true, name: 'unionid', nullable: true })
    unionid?: string;

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

    @Column({ nullable: true, name: 'enroll_type',length: 32 })
    enrollType?: string;  

    @Column({ 
        type: "enum", 
        enum: ["child", "adult"], 
        default: "child",
        name: 'user_type'
    })
    userType: "child" | "adult";

    @Column({ nullable: true, name: 'age' })
    age: number;

    @Column({ nullable: true, name: 'gender' })
    gender: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    // 添加与订单的一对多关联
    @OneToMany(() => Order, order => order.user)
    orders: Order[];

    // 添加与量表答案的一对多关联
    @OneToMany(() => ScaleAnswer, scaleAnswer => scaleAnswer.user)
    scaleAnswers: ScaleAnswer[];

    /**
     * 用户的专业意向列表（一对多关联）
     */
    @OneToMany(() => Intention, intention => intention.user)
    intentions: Intention[];

    /**
     * 用户的备选方案列表（一对多关联）
     */
    @OneToMany(() => Alternative, alternative => alternative.user)
    alternatives: Alternative[];

    /**
     * 用户的专业收藏列表（一对多关联）
     */
    @OneToMany(() => MajorFavorite, majorFavorite => majorFavorite.user)
    majorFavorites: MajorFavorite[];

    /**
     * 用户的省份收藏列表（一对多关联）
     */
    @OneToMany(() => ProvinceFavorite, provinceFavorite => provinceFavorite.user)
    provinceFavorites: ProvinceFavorite[];

    /**
     * 用户的热门专业问卷答案列表（一对多关联）
     */
    @OneToMany(() => PopularMajorAnswer, popularMajorAnswer => popularMajorAnswer.user)
    popularMajorAnswers: PopularMajorAnswer[];
}