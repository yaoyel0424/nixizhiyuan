import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, ManyToOne, JoinColumn, Generated } from "typeorm";
import { Order } from './order.entity';
import { ScaleAnswer } from './scale-answer.entity';
import { Intention } from './intention.entity';
import { Alternative } from './alternative.entity';
import { MajorFavorite } from './major-favorite.entity';
import { ProvinceFavorite } from './province-favorite.entity';
import { PopularMajorAnswer } from './popular-major-answer.entity';
import { Choice } from './choices.entity';
import { Agent } from './agent.entity';

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

    /** 关联的代理商 ID（一个用户对应一个代理商） */
    @Column({ name: 'agent_id', type: 'int', nullable: true, comment: '关联代理商ID' })
    agentId: number | null;

    /** 绑定代理商时的来源：scan=扫码进入，share_link=分享链接进入，默认为空 */
    @Column({ name: 'agent_from', type: 'varchar', length: 32, nullable: true, comment: '绑定代理商来源' })
    agentFrom: string | null;

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

    /**
     * 用户的选择列表（一对多关联）
     */
    @OneToMany(() => Choice, choice => choice.user)
    choices: Choice[];

    /**
     * 用户关联的代理商（多对一：多名用户可属同一代理商，业务上常为一用户一代理商）
     */
    @ManyToOne(() => Agent, (agent) => agent.users, { onDelete: 'SET NULL' })
    @JoinColumn({ name: 'agent_id' })
    agent: Agent | null;
}

