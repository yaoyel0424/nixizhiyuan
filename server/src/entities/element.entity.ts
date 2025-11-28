import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, Generated, OneToMany, ManyToOne } from 'typeorm';
import { DoubleEdgedInfo } from './double-edged-info.entity';
import { Scale } from './scale.entity';
@Entity('elements')
export class Element {
  @PrimaryGeneratedColumn()
  @Generated('increment')
  id: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'type' })
  type: 'like' | 'talent';

  @Column({ name: 'status' })
  status: string;

  @Column({ name: 'dimension' })
  dimension: '看' | '听' | '说' | '记' | '想' | '做' | '运动';

  @Column({ nullable: true, name: 'corresponding_element_id' })
  correspondingElementId: number;

  @OneToOne(() => Element)
  @JoinColumn({ name: 'corresponding_element_id'})
  correspondingElement: Element;

  @Column({ name: 'double_edged_id', nullable: true })
  doubleEdgedId: number;  

  @ManyToOne(() => DoubleEdgedInfo)
  @JoinColumn({ name: 'double_edged_id' })
  doubleEdgedInfo: DoubleEdgedInfo;

  @Column({ name: 'owned_natural_state' })
  ownedNaturalState: string;

  @Column({ name: 'unowned_natural_state' })
  unownedNaturalState: string;

  @OneToMany(() => Scale, scale => scale.element)
  scales: Scale[];
}