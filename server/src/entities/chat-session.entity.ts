import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_sessions')
export class ChatSession {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    userId: number;

    @Column()
    title: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column({ default: false })
    isShared: boolean;

    @Column({ nullable: true })
    shareCode: string;

    @Column({ name: 'can_delete', nullable: true, default: false })
    canDelete: boolean;

    @OneToMany(() => ChatMessage, message => message.session)
    messages: ChatMessage[];
} 