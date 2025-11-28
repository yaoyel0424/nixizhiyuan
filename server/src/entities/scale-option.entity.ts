import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Scale } from './scale.entity';

@Entity('scale_options')
export class ScaleOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'scale_id' })
  scaleId: number;

  @Column({ name: 'option_name', length: 100 })
  optionName: string;

  @Column({ name: 'option_value' })
  optionValue: number;

  @Column({ name: 'display_order', nullable: true })
  displayOrder: number;

  @Column({ name: 'additional_info', type: 'text', nullable: true })
  additionalInfo: string;

  @Column({ name: 'is_default', default: false, select: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at', select: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', select: false })
  updatedAt: Date;

  @ManyToOne(() => Scale, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scale_id' })
  scale: Scale;
}