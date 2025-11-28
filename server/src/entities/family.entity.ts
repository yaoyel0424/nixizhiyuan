import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('family')
export class Family {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  familyName: string;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  role: string;

  @CreateDateColumn()
  createTime: Date;

  @Column()
  creator: string;
}