import { Entity, PrimaryGeneratedColumn,OneToMany, Column, ManyToOne,JoinColumn } from 'typeorm';
import { Element } from './element.entity';
import { ScaleOption } from './scale-option.entity';
import { ScaleAnswer } from './scale-answer.entity';

@Entity('scales')
export class Scale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', name: 'content' })
  content: string;

  @Column({ name: 'element_id' })
  elementId: number;
  @Column({ name: 'type' })
  type: 'like' | 'talent';
  @Column({ name: 'direction' })
  direction: 'positive' | 'negative' | '168';
  @Column({ name: 'dimension' })
  dimension: '看' | '听' | '说' | '记' | '想' | '做' | '运动';
  @ManyToOne(() => Element)
  @JoinColumn({ name: 'element_id' })
  element: Element;

  // action为potential表示为了发现潜能，其他action未定
  @Column({ name: 'action', nullable: true, length:32, default: '' })
  action: string;

  @OneToMany(() => ScaleOption, option => option.scale)
  options: ScaleOption[];

  @OneToMany(() => ScaleAnswer, answer => answer.scale)
  answers: ScaleAnswer[];
}