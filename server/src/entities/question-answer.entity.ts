import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, Generated, Unique, JoinColumn } from 'typeorm';
import { Question } from './question.entity';
import { User } from './user.entity';

@Entity('question_answers')
@Unique(['userId', 'questionId'])
export class QuestionAnswer {
  @PrimaryGeneratedColumn()
  @Generated('increment')
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'question_id' })
  questionId: number;

  @Column({ type: 'text', name: 'content' })
  content: string;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ name: 'submitted_by' })
  submittedBy: string;

  @UpdateDateColumn({ name: 'last_modified_at' })
  lastModifiedAt: Date;

  @ManyToOne(() => Question)
  @JoinColumn({name: 'question_id'})
  question: Question;

  @JoinColumn({name: 'user_id'})
  @ManyToOne(() => User)
  user: User;
}