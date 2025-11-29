import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { DoubleEdgedInfo } from './double-edged-info.entity';

export type DoubleEdgedType = 
  | 'inner_state'
  | 'associate_with_people'
  | 'tackle_issues'
  | 'face_choices'
  | 'common_outcome'
  | 'normal_state';

@Entity('double_edged_scales')
export class DoubleEdgedScale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  dimension: string;
 
  @Column({name:"double_edged_id"})
  doubleEdgedId: number;

  @ManyToOne(() => DoubleEdgedInfo)
  @JoinColumn({name:"double_edged_id"})
  doubleEdged: DoubleEdgedInfo;

  @Column()
  content: string;

  @Column({
    type: 'enum',
    enum: [
      'inner_state',
      'associate_with_people',
      'tackle_issues', 
      'face_choices',
      'common_outcome',
      'normal_state'
    ]
  })
  type: DoubleEdgedType;
}