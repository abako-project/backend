import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { EPOCH_MS_COLUMN, epochMsTransformer } from '../driver';

export interface MilestoneRequirement {
  assignmentKey: string;
  roleId: number;
  hours: number;
  skillIds: number[];
}

@Entity('milestones')
@Index(['contractAddress'])
export class Milestone {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  budget: number;

  @Column()
  deliveryTime: number;

  @Column({ type: EPOCH_MS_COLUMN, nullable: true, transformer: epochMsTransformer })
  deliveryDate: number;

  @Column({ default: 0 })
  displayOrder: number;

  @Column()
  contractAddress: string;

  @Column({ nullable: true })
  developerId: number;

  @Column({ default: 'pending' })
  state: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ type: 'simple-json', default: '[]' })
  requirements: MilestoneRequirement[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
