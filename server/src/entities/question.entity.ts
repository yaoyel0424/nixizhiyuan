import { Entity, PrimaryGeneratedColumn, Column, Generated } from 'typeorm';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  @Generated('increment')
  id: number;

  @Column({ type: 'text', name: 'content' })
  content: string;

  @Column({ name: 'age_range' })
  ageRange: '4-8' | '9-14' | '14+';
}