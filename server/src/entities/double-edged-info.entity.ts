import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Element } from './element.entity';

@Entity('double_edged_infos')
export class DoubleEdgedInfo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'like_element_id' })
  likeElementId: number;

  @Column({ name: 'talent_element_id' })
  talentElementId: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ type: 'text', name: 'demonstrate' })
  demonstrate: string;

  @Column({ type: 'text', name: 'affect' })
  affect: string;

  @ManyToOne(() => Element)
  @JoinColumn({ name: 'like_element_id' })
  likeElement: Element;

  @ManyToOne(() => Element)
  @JoinColumn({ name: 'talent_element_id' })
  talentElement: Element;
} 